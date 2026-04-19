import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Phone, Lock, User as UserIcon, Loader2, Check, MapPin, ArrowRight, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { chinaCities } from '@/data/constants';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';
import { API_BASE_URL } from '@/config/api';

type Role = 'user' | 'business' | 'artist_dj' | 'vendor';
type AuthMethod = 'email' | 'phone';

interface RegistrationData {
  email?: string;
  phone?: string;
  password: string;
  first_name: string;
  last_name: string;
  city_id: string;
  role_type: Role | '';
}

const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoading } = useAuthStore();

  const [selectedRole, setSelectedRole] = useState<Role | ''>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');

  // Visible OTP state
  const [showOTP, setShowOTP] = useState(false);
  const [enteredOTP, setEnteredOTP] = useState('');
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRole) {
      toast.error(t('auth.register.selectRoleError'));
      return;
    }

    if (!name || !password) {
      toast.error(t('auth.register.fillAllFieldsError'));
      return;
    }

    if (authMethod === 'email' && !email) {
      toast.error(t('auth.register.enterEmailError'));
      return;
    }

    if (authMethod === 'phone' && !phone) {
      toast.error(t('auth.register.enterPhoneError'));
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
      // Split name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Store registration data for after verification
      const regData = {
        email: authMethod === 'email' ? email : undefined,
        phone: authMethod === 'phone' ? phone : undefined,
        password,
        first_name: firstName,
        last_name: lastName,
        city_id: selectedCityId,
        role_type: selectedRole,
      };
      setRegistrationData(regData);

      // Send real OTP via Email (SendGrid) or SMS (Twilio)
      const identifier = authMethod === 'email' ? email : phone;
      const isEmailAuth = authMethod === 'email';
      
      const endpoint = isEmailAuth 
        ? `${API_BASE_URL}/otp/email/send` 
        : `${API_BASE_URL}/otp/sms/send`;
      
      const body = isEmailAuth
        ? JSON.stringify({ email: identifier, purpose: 'register' })
        : JSON.stringify({ phone: identifier, purpose: 'register' });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || t('auth.register.failedToSendOTP'));
      }

      const data = await response.json();
      
      if (data.success) {
        setShowOTP(true);
        // Real OTP sent via email/SMS - user needs to check their inbox
        toast.success(data.message || t('auth.register.otpSentMessage', { destination: isEmailAuth ? t('auth.register.email') : t('auth.register.phone') }));
      } else {
        throw new Error(data.message || t('auth.register.failedToSendOTP'));
      }

    } catch (error: unknown) {
      toast.error((error as Error).message || t('auth.register.registrationFailed'));
    }
  };

  const handleVerifyOTP = async () => {
    if (!enteredOTP || enteredOTP.length < 4) {
      toast.error(t('auth.register.enterVerificationCodeError'));
      return;
    }

    setIsVerifying(true);
    try {
      const identifier = authMethod === 'email' ? email : phone;
      
      // Verify OTP with registration data using the real OTP verify endpoint
      const verifyResponse = await fetch(`${API_BASE_URL}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          code: enteredOTP,
          password: registrationData.password,
          first_name: registrationData.first_name,
          last_name: registrationData.last_name,
          city_id: registrationData.city_id,
          role_type: registrationData.role_type
        })
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        throw new Error(verifyData.message || t('auth.register.invalidVerificationCode'));
      }

      // Set auth state with the token from OTP verification
      if (verifyData.token) {
        localStorage.setItem('auth-token', verifyData.token);
        // Update auth store
        await useAuthStore.getState().refreshSession();
      }

      toast.success(t('auth.register.accountCreated'));
      navigate('/');

    } catch (error: unknown) {
      toast.error((error as Error).message || t('auth.register.verificationFailed'));
    } finally {
      setIsVerifying(false);
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
        <h1 className="text-3xl font-bold text-white mb-2">{t('auth.register.title')}</h1>
        <p className="text-gray-400 text-sm">{t('auth.register.subtitle')}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Selection - Dropdown */}
        <div>
          <label className="block text-gray-400 text-sm mb-2">
            <UserIcon className="w-4 h-4 inline mr-1" />
            {t('auth.register.roleLabel')}
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as Role)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none transition-colors appearance-none cursor-pointer"
            required
            disabled={showOTP}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
          >
            <option value="" className="bg-[#111111]">{t('auth.register.rolePlaceholder')}</option>
            <option value="user" className="bg-[#111111]">{t('auth.register.roleUser')}</option>
            <option value="business" className="bg-[#111111]">{t('auth.register.roleBusiness')}</option>
            <option value="vendor" className="bg-[#111111]">{t('auth.register.roleVendor')}</option>
            <option value="artist_dj" className="bg-[#111111]">{t('auth.register.roleArtist')}</option>
          </select>
          <p className="text-gray-500 text-xs mt-2">
            {t('auth.register.roleHint')}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">{t('auth.register.fullNameLabel')}</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.register.fullNamePlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                required
                disabled={showOTP}
              />
            </div>
          </div>

          {/* City Selection */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Select Your City in China *
            </label>
            <select
              value={selectedCityId}
              onChange={(e) => setSelectedCityId(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none transition-colors appearance-none cursor-pointer"
              required
              disabled={showOTP}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
            >
              <option value="" className="bg-[#111111]">{t('auth.register.cityPlaceholder')}</option>
              {chinaCities.map(city => (
                <option key={city.id} value={city.id} className="bg-[#111111]">
                  {city.name} {city.nameCN}
                </option>
              ))}
            </select>
          </div>

          {/* Auth Method Tabs */}
          {!showOTP && (
            <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
              <button
                type="button"
                onClick={() => setAuthMethod('email')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  authMethod === 'email'
                    ? 'bg-[#d3da0c] text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4" />
                {t('auth.register.emailTab')}
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('phone')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  authMethod === 'phone'
                    ? 'bg-[#d3da0c] text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Phone className="w-4 h-4" />
                {t('auth.register.phoneTab')}
              </button>
            </div>
          )}

          {/* Email Input */}
          {authMethod === 'email' && (
            <div>
              <label className="block text-gray-400 text-sm mb-2">{t('auth.register.emailLabel')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.register.emailPlaceholder')}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                  required
                  disabled={showOTP}
                />
              </div>
              <p className="text-gray-500 text-xs mt-2">
                {showOTP ? t('auth.register.codeShown') : t('auth.register.codeWillBeGenerated')}
              </p>
            </div>
          )}

          {/* Phone Input */}
          {authMethod === 'phone' && (
            <div>
              <label className="block text-gray-400 text-sm mb-2">{t('auth.register.phoneLabel')}</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('auth.register.phonePlaceholder')}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                  required
                  disabled={showOTP}
                />
              </div>
              <p className="text-gray-500 text-xs mt-2">
                {showOTP ? 'Your verification code is shown below' : 'We\'ll generate a verification code for you'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-gray-400 text-sm mb-2">{t('auth.register.passwordLabel')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.register.passwordPlaceholder')}
                className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                required
                disabled={showOTP}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                disabled={showOTP}
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
                      className={`h-1 flex-1 rounded-full transition-colors ${i < passwordStrength() ? strengthColors[passwordStrength() - 1] : 'bg-white/10'
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
            <label className="block text-gray-400 text-sm mb-2">{t('auth.register.confirmPasswordLabel')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.register.passwordPlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                required
                disabled={showOTP}
              />
            </div>
          </div>
        </div>

        {/* Terms */}
        {!showOTP && (
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setAgreeTerms(!agreeTerms)}
              className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${agreeTerms
                ? 'bg-[#d3da0c] border-[#d3da0c]'
                : 'border-white/20 hover:border-white/40'
                }`}
            >
              {agreeTerms && <Check className="w-3 h-3 text-black" />}
            </button>
            <p className="text-gray-400 text-sm text-left">
              {t('auth.register.agreeText')}{' '}
              <Link to="/about" className="text-[#d3da0c] hover:underline font-medium">
                {t('auth.register.termsOfService')}
              </Link>{' '}
              {t('auth.register.and')}{' '}
              <Link to="/about" className="text-[#d3da0c] hover:underline font-medium">
                {t('auth.register.privacyPolicy')}
              </Link>
            </p>
          </div>
        )}

        {/* Create Account Button */}
        {!showOTP && (
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
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
        )}
      </form>

      {/* OTP Verification Section */}
      {showOTP && (
        <div className="mt-6 p-6 bg-[#1a1a1a] border border-[#d3da0c]/30 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-2 text-center">
            {t('auth.register.checkYour', { method: authMethod === 'email' ? t('auth.register.email') : t('auth.register.phone') })}
          </h3>
          
          <p className="text-gray-400 text-sm text-center mb-6">
            {t('auth.register.otpInstructions')}<br/>
            <span className="text-white font-medium">{authMethod === 'email' ? email : phone}</span>
          </p>

          {/* OTP Input */}
          <div className="space-y-4">
            <input
              type="text"
              value={enteredOTP}
              onChange={(e) => setEnteredOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('auth.register.otpPlaceholder')}
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
                  Verifying...
                </>
              ) : (
                <>
                  Verify & Continue
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
              {t('auth.register.goBackEdit')}
            </button>
          </div>
        </div>
      )}

      {/* Google Sign Up - Only show when not in OTP mode and role is selected */}
      {!showOTP && selectedRole && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#111111] text-gray-500">{t('auth.register.orSignUpWith')}</span>
            </div>
          </div>

          <div className="flex justify-center mb-6">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                try {
                  const response = await fetch(`${API_BASE_URL}/auth/google/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      token: credentialResponse.credential,
                      role: selectedRole.toUpperCase()
                    }),
                  });

                  const data = await response.json();

                  if (response.ok) {
                    localStorage.setItem('auth-token', data.access_token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    toast.success(t('auth.register.accountCreated'));
                    navigate(data.redirect_url || '/');
                  } else {
                    toast.error(data.detail || t('auth.register.googleSignUpFailed'));
                  }
                } catch (error) {
                  toast.error('Google sign up error');
                  console.error(error);
                }
              }}
              onError={() => toast.error(t('auth.register.googleSignUpFailed'))}
              useOneTap
              theme="filled_black"
              shape="pill"
              text="signup_with"
            />
          </div>
        </>
      )}

      {/* Sign In Link */}
      {!showOTP && (
        <p className="text-center text-gray-400 text-sm mt-8 pb-8">
          {t('auth.register.alreadyHaveAccount')}{' '}
          <Link to="/login" className="text-[#d3da0c] hover:underline font-semibold">
            {t('auth.register.signInLink')}
          </Link>
        </p>
      )}
    </div>
  );
};

export default Register;
