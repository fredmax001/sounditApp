import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const ResetPassword = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError(t('auth.resetPassword.invalidToken'));
        setIsVerifying(false);
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/auth/verify-reset-token?token=${token}`);
        if (response.data.valid) {
          setIsValid(true);
        } else {
          setError(response.data.message || t('auth.resetPassword.invalidOrExpiredToken'));
        }
      } catch (err: unknown) {
        console.error('Token verification error:', err);
        setError(t('auth.resetPassword.failedToVerifyToken'));
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!password || !confirmPassword) {
      toast.error(t('auth.resetPassword.fillAllFieldsError'));
      return;
    }
    
    if (password.length < 6) {
      toast.error(t('auth.resetPassword.passwordMinLength'));
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error(t('auth.resetPassword.passwordsDoNotMatch'));
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        token,
        new_password: password
      });
      
      if (response.data.success) {
        setIsSuccess(true);
        toast.success(t('auth.resetPassword.resetSuccess'));
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        toast.error(response.data.message || t('auth.resetPassword.failedToResetPassword'));
      }
    } catch (error: unknown) {
      console.error('Reset password error:', error);

      const err = error as { response?: { data?: { detail?: string } } };
      if (err.response?.data?.detail) {
        toast.error(err.response.data.detail);
      } else {
        toast.error(t('auth.resetPassword.failedToResetPassword'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while verifying token
  if (isVerifying) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#d3da0c]" />
        <p className="text-gray-400">{t('auth.resetPassword.verifyingResetLink')}</p>
      </div>
    );
  }

  // Error state - invalid/expired token
  if (error || !isValid) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">{t('auth.resetPassword.invalidLinkTitle')}</h2>
        <p className="text-gray-400 mb-6">
          {error || t('auth.resetPassword.invalidLinkMessage')}
        </p>
        <Link
          to="/forgot-password"
          className="inline-flex items-center gap-2 text-[#d3da0c] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('auth.resetPassword.requestNewLink')}
        </Link>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#d3da0c]/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-[#d3da0c]" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">{t('auth.resetPassword.successTitle')}</h2>
        <p className="text-gray-400 mb-2">
          {t('auth.resetPassword.successMessage')}
        </p>
        <p className="text-gray-500 text-sm mb-6">
          {t('auth.resetPassword.redirecting')}
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-[#d3da0c] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('auth.resetPassword.goToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">{t('auth.resetPassword.title')}</h1>
        <p className="text-gray-400 text-sm">
          {t('auth.resetPassword.subtitle')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div>
          <label className="block text-gray-400 text-sm mb-2">{t('auth.resetPassword.newPasswordLabel')}</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
              disabled={isLoading}
              className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-gray-400 text-sm mb-2">{t('auth.resetPassword.confirmPasswordLabel')}</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
              disabled={isLoading}
              className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Password Requirements */}
        <div className="text-xs text-gray-500 space-y-1">
          <p className={password.length >= 6 ? 'text-green-500' : ''}>
            {password.length >= 6 ? t('auth.resetPassword.requirementOk') : '•'} {t('auth.resetPassword.atLeast6Chars')}
          </p>
          <p className={password === confirmPassword && password !== '' ? 'text-green-500' : ''}>
            {password === confirmPassword && password !== '' ? t('auth.resetPassword.requirementOk') : '•'} {t('auth.resetPassword.passwordsMatch')}
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || password.length < 6 || password !== confirmPassword}
          className="w-full py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('auth.resetPassword.resetting')}
            </>
          ) : (
            t('auth.resetPassword.resetButton')
          )}
        </button>
      </form>

      {/* Back Link */}
      <p className="text-center text-gray-400 text-sm mt-6">
        <Link to="/login" className="text-[#d3da0c] hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('auth.resetPassword.backToSignIn')}
        </Link>
      </p>
    </div>
  );
};

export default ResetPassword;
