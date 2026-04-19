import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error(t('auth.forgotPassword.enterEmailError'));
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(t('auth.forgotPassword.validEmailError'));
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Call the real backend API
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        email: email.trim()
      });
      
      if (response.data.success) {
        setIsSent(true);
        toast.success(t('auth.forgotPassword.resetLinkSent'));
      } else {
        toast.error(response.data.message || t('auth.forgotPassword.failedToSendResetLink'));
      }
    } catch (error: unknown) {
      console.error('Forgot password error:', error);

      const err = error as { response?: { data?: { detail?: string }; status?: number }; code?: string };

      // Handle different error scenarios
      if (err.response?.data?.detail) {
        toast.error(err.response.data.detail);
      } else if (err.response?.status === 404) {
        // Don't reveal if email exists - show same success message
        setIsSent(true);
        toast.success(t('auth.forgotPassword.accountExistsMessage'));
      } else if (err.code === 'ECONNABORTED') {
        toast.error(t('auth.forgotPassword.requestTimedOut'));
      } else {
        toast.error(t('auth.forgotPassword.failedToSendResetLinkLater'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#d3da0c]/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-[#d3da0c]" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">{t('auth.forgotPassword.checkYourEmail')}</h2>
        <p className="text-gray-400 mb-6">
          {t('auth.forgotPassword.resetLinkInstructions')}<br />
          <span className="text-white">{email}</span>
        </p>
        <p className="text-gray-500 text-sm mb-6">
          {t('auth.forgotPassword.linkExpiration')}
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-[#d3da0c] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">{t('auth.forgotPassword.title')}</h1>
        <p className="text-gray-400 text-sm">
          {t('auth.forgotPassword.subtitle')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-400 text-sm mb-2">{t('auth.forgotPassword.emailLabel')}</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
              disabled={isLoading}
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors disabled:opacity-50"
            />
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
              {t('auth.forgotPassword.sending')}
            </>
          ) : (
            t('auth.forgotPassword.sendResetLink')
          )}
        </button>
      </form>

      {/* Back Link */}
      <p className="text-center text-gray-400 text-sm mt-6">
        <Link to="/login" className="text-[#d3da0c] hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
      </p>
    </div>
  );
};

export default ForgotPassword;
