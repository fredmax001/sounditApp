import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Loader2, Mail, ArrowRight, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';
import { API_BASE_URL } from '@/config/api';

type AuthMethod = 'email' | 'phone';
type LoginMode = 'otp' | 'password';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setSelectedCity, isLoading, loginWithEmail } = useAuthStore();

  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Visible OTP state
  const [showOTP, setShowOTP] = useState(false);
  const [enteredOTP, setEnteredOTP] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [identifier, setIdentifier] = useState('');

  interface Profile {
    role?: string;
    role_type?: string;
  }

  // Determine redirect path based on user's role
  const getRedirectPath = (profile: Profile | null): string => {
    // Removed console.log for production
    if (!profile) {
      // Removed console.log for production
      return '/';
    }

    // Handle both frontend profile format (role_type/role) and backend UserResponse format
    const roleType = profile.role_type || profile.role;
    const legacyRole = profile.role;

    // Removed console.log for production

    // Admin → Admin Dashboard (check both frontend role_type and backend role)
    if (roleType === 'admin' ||
      roleType === 'super_admin' ||
      legacyRole === 'admin' ||
      legacyRole === 'super_admin' ||
      profile.role === 'ADMIN' ||
      profile.role === 'SUPER_ADMIN') {
      // Removed console.log for production
      return '/admin/dashboard';
    }

    // Business (includes legacy Organizer role) → Business Dashboard
    if (roleType === 'business' ||
      legacyRole === 'organizer' ||
      legacyRole === 'business' ||
      profile.role === 'BUSINESS' ||
      profile.role === 'ORGANIZER') {
      // Removed console.log for production
      return '/dashboard/business';
    }

    // Artist/DJ → Artist Dashboard
    if (roleType === 'artist' ||
      legacyRole === 'dj' ||
      legacyRole === 'artist' ||
      profile.role === 'ARTIST') {
      // Removed console.log for production
      return '/dashboard/artist';
    }

    // Vendor → Vendor Dashboard
    if (roleType === 'vendor' ||
      legacyRole === 'vendor' ||
      profile.role === 'VENDOR') {
      // Removed console.log for production
      return '/dashboard/vendor';
    }

    // Regular users → Home page
    // Removed console.log for production
    return '/';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentIdentifier = authMethod === 'email' ? email : phone;

    if (!currentIdentifier) {
      toast.error(t('auth.login.enterIdentifierError', { method: authMethod === 'email' ? t('auth.login.email') : t('auth.login.phoneNumber') }));
      return;
    }

    // If password mode, use password login
    if (loginMode === 'password') {
      if (!password) {
        toast.error(t('auth.login.enterPasswordError'));
        return;
      }

      try {
        let userProfile = null;

        if (authMethod === 'email') {
          userProfile = await loginWithEmail(email, password);

          // If profile not returned, try to get from store
          if (!userProfile) {
            userProfile = useAuthStore.getState().profile;
          }
        } else {
          // Phone + password login
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

          // Store token and set auth state
          localStorage.setItem('auth-token', data.access_token);

          // Get the user from response and map it to frontend profile format
          const backendUser = data.user;
          const backendRole = (backendUser.role || '').toLowerCase();

          // Map role similar to loginWithEmail
          let role_type = 'user';
          let role = 'user';

          // BUSINESS and ORGANIZER roles are unified as Business
          if (backendRole === 'business' || backendRole === 'organizer') {
            role_type = 'business';
            role = 'organizer'; // Keep for backend compatibility
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

          // Construct proper profile object with mapped roles
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

          // Sync city from profile
          const profileCity = backendUser.preferred_city || backendUser.city_id || '';
          if (profileCity) {
            setSelectedCity(profileCity);
          }
        }

        // Also sync city for email login from store profile if available
        if (authMethod === 'email') {
          const storeProfile = useAuthStore.getState().profile;
          const profileCity = (storeProfile as any)?.preferred_city || (storeProfile as any)?.city_id || '';
          if (profileCity) {
            setSelectedCity(profileCity);
          }
        }

        toast.success(t('auth.login.welcomeBack'));

        // Redirect based on role
        // Removed console.log for production
        const redirectPath = getRedirectPath(userProfile);
        // Removed console.log for production

        // Force redirect for admin users
        if (redirectPath === '/admin/dashboard') {
          window.location.href = '/admin/dashboard';
        } else {
          navigate(redirectPath);
        }
      } catch (error) {
        toast.error((error as Error).message || t('auth.login.loginFailed'));
      }
      return;
    }

    // OTP mode - Send real OTP via Email (SendGrid) or SMS (Twilio)
    try {
      const isEmail = authMethod === 'email';
      const endpoint = isEmail
        ? `${API_BASE_URL}/otp/email/send`
        : `${API_BASE_URL}/otp/sms/send`;

      const body = isEmail
        ? JSON.stringify({ email: currentIdentifier, purpose: 'login' })
        : JSON.stringify({ phone: currentIdentifier, purpose: 'login' });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || t('auth.login.failedToSendOTP'));
      }

      const data = await response.json();

      if (data.success) {
        setIdentifier(currentIdentifier);
        setShowOTP(true);
        toast.success(data.message || t('auth.login.otpSentMessage', { destination: isEmail ? t('auth.login.email') : t('auth.login.phone') }));
      } else {
        throw new Error(data.message || t('auth.login.failedToSendOTP'));
      }
    } catch (error) {
      toast.error((error as Error).message || t('auth.login.failedToSendVerificationCode'));
    }
  };

  const handleVerifyOTP = async () => {
    if (!enteredOTP || enteredOTP.length < 4) {
      toast.error(t('auth.login.enterVerificationCodeError'));
      return;
    }

    setIsVerifying(true);
    try {
      // Use the real OTP verify endpoint
      const verifyResponse = await fetch(`${API_BASE_URL}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          code: enteredOTP
        })
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        throw new Error(verifyData.message || t('auth.login.invalidVerificationCode'));
      }

      if (verifyData.token) {
        localStorage.setItem('auth_token', verifyData.token);
        localStorage.setItem('auth-token', verifyData.token);
        toast.success(t('auth.login.welcomeBack'));

        // Fetch user profile to determine redirect
        const profileResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${verifyData.token}` }
        });

        let userProfile = null;
        if (profileResponse.ok) {
          const backendUser = await profileResponse.json();

          // Map role similar to loginWithEmail
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

          // Construct proper profile object
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

          // Sync city from profile
          const profileCity = backendUser.preferred_city || backendUser.city_id || '';
          if (profileCity) {
            setSelectedCity(profileCity);
          }
        }

        // Get redirect path based on user profile
        const redirectPath = getRedirectPath(userProfile);
        // Removed console.log for production

        // Force redirect for admin users
        if (redirectPath === '/admin/dashboard') {
          window.location.href = '/admin/dashboard';
        } else {
          navigate(redirectPath);
        }
      }

    } catch (error) {
      toast.error((error as Error).message || t('auth.login.verificationFailed'));
    } finally {
      setIsVerifying(false);
    }
  };

  // Google login handler
  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token and user data
        localStorage.setItem('auth-token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        // Sync city from Google profile
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
      <div className="text-center mb-8">
        <img src="/logo.png" alt={t('auth.login.logoAlt')} className="h-16 w-auto mx-auto mb-4" />
        <h1 className="text-2xl font-semibold text-white mb-2">{t('auth.login.title')}</h1>
        <p className="text-gray-400 text-sm">{t('auth.login.subtitle')}</p>
      </div>

      {!showOTP ? (
        <>
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

          {/* Login Mode Tabs */}
          <div className="flex gap-1 sm:gap-2 p-1 bg-white/5 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => setLoginMode('otp')}
              className={`flex-1 px-1 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${loginMode === 'otp'
                ? 'bg-white/20 text-white'
                : 'text-gray-400 hover:text-white'
                }`}
            >
              {t('auth.login.verificationCodeTab')}
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('password')}
              className={`flex-1 px-1 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${loginMode === 'password'
                ? 'bg-white/20 text-white'
                : 'text-gray-400 hover:text-white'
                }`}
            >
              {t('auth.login.passwordTab')}
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

            {/* Password Input (only in password mode) */}
            {loginMode === 'password' && (
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
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {loginMode === 'otp' ? t('auth.login.generatingCode') : t('auth.login.signingIn')}
                </>
              ) : (
                loginMode === 'otp' ? t('auth.login.sendVerificationCode') : t('auth.login.signIn')
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
        </>
      ) : (
        /* OTP Verification Section */
        <div className="p-6 bg-[#1a1a1a] border border-[#d3da0c]/30 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-2 text-center">
            {t('auth.login.checkYour', { method: authMethod === 'email' ? t('auth.login.email') : t('auth.login.phone') })}
          </h3>

          <p className="text-gray-400 text-sm text-center mb-6">
            {t('auth.login.otpInstructions')}<br />
            <span className="text-white font-medium">{identifier}</span>
          </p>

          {/* OTP Input */}
          <div className="space-y-4">
            <input
              type="text"
              value={enteredOTP}
              onChange={(e) => setEnteredOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('auth.login.otpPlaceholder')}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-center text-xl font-mono tracking-widest placeholder-gray-600 focus:border-[#d3da0c] focus:outline-none transition-colors"
              maxLength={6}
            />

            <button
              onClick={handleVerifyOTP}
              disabled={isVerifying || enteredOTP.length < 4}
              className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('auth.login.verifying')}
                </>
              ) : (
                <>
                  {t('auth.login.verifyAndSignIn')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              onClick={() => {
                setShowOTP(false);
                setEnteredOTP('');
              }}
              className="w-full py-2 text-gray-400 text-sm hover:text-white transition-colors"
            >
              {t('auth.login.goBackToChange', { method: authMethod === 'email' ? t('auth.login.email') : t('auth.login.phoneNumber') })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
