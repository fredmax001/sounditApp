import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

interface LocationState {
  phone?: string;
  from?: string;
  registrationData?: {
    first_name: string;
    last_name: string;
    city_id: string;
  } | null;
}

const VerifyOTP = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOTP, isLoading } = useAuthStore();

  const phone = (location.state as LocationState)?.phone || '';
  const from = (location.state as LocationState)?.from || '/';
  const registrationData = (location.state as LocationState)?.registrationData || null;
  const isRegistration = !!registrationData;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!phone) {
      navigate('/login');
      return;
    }

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
  }, [phone, navigate]);

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

    try {
      const success = await verifyOTP(phone, code);
      if (success) {
        toast.success(t('auth.verifyOTP.phoneVerified'));
        
        // If this is registration, we need to complete the registration
        if (isRegistration && registrationData) {
          await completeRegistration();
        } else {
          navigate(from);
        }
      } else {
        toast.error(t('auth.verifyOTP.invalidCode'));
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error: unknown) {
      toast.error((error as Error).message || t('auth.verifyOTP.verificationFailed'));
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const completeRegistration = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const token = localStorage.getItem('auth-token');
      
      if (!token) {
        toast.error(t('auth.verifyOTP.noAuthToken'));
        return;
      }

      // Update user profile with registration data
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: registrationData.first_name,
          last_name: registrationData.last_name,
          preferred_city: registrationData.city_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete registration');
      }

      toast.success(t('auth.verifyOTP.accountCreated'));
      navigate('/dashboard/user');
    } catch (error: unknown) {
      toast.error((error as Error).message || t('auth.verifyOTP.registrationFailed'));
    }
  };

  const handleResend = async () => {
    const { sendOTP } = useAuthStore.getState();
    try {
      await sendOTP(phone);
      setResendTimer(60);
      toast.success(t('auth.verifyOTP.newCodeSent'));
    } catch (error: unknown) {
      toast.error((error as Error).message || t('auth.verifyOTP.failedToResend'));
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">{t('auth.verifyOTP.title')}</h1>
        <p className="text-gray-400 text-sm">
          {t('auth.verifyOTP.instructions')}<br />
          <span className="text-white">{phone}</span>
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
            {t('auth.verifyOTP.verifying')}
          </>
        ) : (
          t('auth.verifyOTP.verifyButton')
        )}
      </button>

      {/* Resend */}
      <p className="text-center text-gray-400 text-sm mt-6">
        {t('auth.verifyOTP.didntReceiveCode')}{' '}
        {resendTimer > 0 ? (
          <span className="text-gray-500">
            {t('auth.verifyOTP.resendIn', { seconds: resendTimer })}
          </span>
        ) : (
          <button
            onClick={handleResend}
            className="text-[#d3da0c] hover:underline"
          >
            {t('auth.verifyOTP.resendButton')}
          </button>
        )}
      </p>

      {/* Back Link */}
      <p className="text-center text-gray-400 text-sm mt-4">
        <button
          onClick={() => navigate(isRegistration ? '/register' : '/login')}
          className="text-[#d3da0c] hover:underline inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('auth.verifyOTP.backTo', { page: isRegistration ? t('auth.verifyOTP.signUp') : t('auth.verifyOTP.signIn') })}
        </button>
      </p>

      {/* Info */}
      <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
        <p className="text-gray-400 text-xs text-center">
          ðŸ“± {t('auth.verifyOTP.infoLine1')}<br />
          {t('auth.verifyOTP.infoLine2')}
        </p>
      </div>
    </div>
  );
};

export default VerifyOTP;
