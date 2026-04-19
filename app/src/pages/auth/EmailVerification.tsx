import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft, Mail, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

interface LocationState {
  email?: string;
  registrationData?: { role_type?: string } | null;
}

const EmailVerification = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { sendOTP, verifyOTP } = useAuthStore();

  const state = location.state as LocationState | undefined;
  const email = state?.email || '';
  const registrationData = state?.registrationData || null;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSendOTP = useCallback(async () => {
    try {
      await sendOTP(email);
      toast.success(t('auth.emailVerification.codeSent'));
    } catch (error) {
      toast.error((error as Error).message || t('auth.emailVerification.failedToSendCode'));
    }
  }, [sendOTP, email]);

  useEffect(() => {
    if (!email) {
      navigate('/register');
      return;
    }

    // Send OTP on mount
    handleSendOTP();

    // Start resend timer
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email, navigate, handleSendOTP]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (index === 5 && value) {
      const code = [...newOtp.slice(0, 5), value].join('');
      handleVerify(code);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code: string) => {
    if (code.length !== 6) return;

    setIsLoading(true);

    const success = await verifyOTP(email, code);

    if (success) {
      toast.success(t('auth.emailVerification.emailVerified'));

      // Redirect based on role if registration data exists
      if (registrationData) {
        const rt = registrationData.role_type;
        // BUSINESS and ORGANIZER roles are unified - both go to Business Dashboard
        if (rt === 'business' || rt === 'organizer' || rt === 'vendor') {
          navigate('/dashboard/business');
        } else if (rt === 'artist_dj' || rt === 'artist' || rt === 'dj') {
          navigate('/dashboard/artist');
        } else {
          navigate('/');
        }
      } else {
        // Just verifying email (for password reset, etc.)
        navigate('/');
      }
    } else {
      toast.error(t('auth.emailVerification.invalidCode'));
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }

    setIsLoading(false);
  };

  const handleResend = async () => {
    setResendTimer(60);
    await handleSendOTP();
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#d3da0c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-[#d3da0c]" />
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">{t('auth.emailVerification.title')}</h1>
        <p className="text-gray-400 text-sm">
          {t('auth.emailVerification.instructions')}<br />
          <span className="text-[#d3da0c] font-medium">{email}</span>
        </p>
      </div>



      {/* OTP Inputs */}
      <div className="flex justify-center gap-2 mb-6">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-12 h-14 text-center text-2xl font-semibold bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none transition-colors"
          />
        ))}
      </div>

      {/* Verify Button */}
      <button
        onClick={() => handleVerify(otp.join(''))}
        disabled={isLoading || otp.some(d => !d)}
        className="w-full py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('auth.emailVerification.verifying')}
          </>
        ) : (
          t('auth.emailVerification.verifyButton')
        )}
      </button>

      {/* Resend */}
      <p className="text-center text-gray-400 text-sm mt-6">
        {t('auth.emailVerification.didntReceiveCode')}{' '}
        {resendTimer > 0 ? (
          <span className="text-gray-500">
            {t('auth.emailVerification.resendIn', { seconds: resendTimer })}
          </span>
        ) : (
          <button
            onClick={handleResend}
            className="text-[#d3da0c] hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            {t('auth.emailVerification.resendButton')}
          </button>
        )}
      </p>

      {/* Back Link */}
      <p className="text-center text-gray-400 text-sm mt-4">
        <button
          onClick={() => navigate('/register')}
          className="text-[#d3da0c] hover:underline inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('auth.emailVerification.backToSignUp')}
        </button>
      </p>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
        <p className="text-gray-400 text-xs text-center">
          ðŸ”’ {t('auth.emailVerification.infoLine1')}
          {t('auth.emailVerification.infoLine2')}
        </p>
      </div>
    </div>
  );
};

export default EmailVerification;
