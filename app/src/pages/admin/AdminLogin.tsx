import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loginWithEmail } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.documentElement.style.colorScheme = 'dark';
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin()) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter your administrator email and password.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API_BASE_URL}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const data = await res.json().catch(() => ({}));
      if (data?.requires_2fa && data?.two_factor_token) {
        setTwoFactorToken(data.two_factor_token);
        setOtpCode('');
        setPassword('');
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error?.message || data?.detail || 'Administrator authentication failed.');
      }

      await loginWithEmail(email.trim().toLowerCase(), password, data);
      toast.success('Signed in to Admin Console');
      navigate('/admin', { replace: true });
    } catch (error) {
      const msg = (error as Error)?.name === 'AbortError'
        ? 'Connection timed out. Please try again.'
        : (error as Error)?.message || 'Authentication failed.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorToken || otpCode.length !== 6 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/2fa/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ two_factor_token: twoFactorToken, code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.detail || 'Invalid verification code.');
      }
      const role = String(data?.user?.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'super_admin') {
        throw new Error('Access denied. Administrator role required.');
      }
      await loginWithEmail(email.trim().toLowerCase(), '', data);
      toast.success('Signed in to Admin Console');
      navigate('/admin', { replace: true });
    } catch (error) {
      toast.error((error as Error)?.message || 'Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-shell min-h-dvh w-full bg-[#020b00] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-[#0b120a] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#d3da0c]/15 border border-[#d3da0c]/35 flex items-center justify-center text-[#d3da0c]">
            <Shield className="w-6 h-6" />
          </div>
          <img
            src="/logo-dark.png"
            alt="Sound It"
            className="h-6 w-auto object-contain"
          />
          <div>
            <p className="text-[0.6875rem] uppercase tracking-widest text-[#d3da0c]">
              Restricted Access
            </p>
            <h1 className="text-xl text-white mt-1">
              Sound It Admin Console
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Authorized platform administrators only. All sign-in attempts are audited.
            </p>
          </div>
        </div>

        {twoFactorToken ? (
          <form onSubmit={handleVerify2fa} className="space-y-4">
            <div className="rounded-xl bg-black/40 border border-white/10 p-3.5 text-xs text-gray-300 flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 text-[#d3da0c] shrink-0" />
              <span>Enter the 6-digit authenticator code for your administrator account.</span>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 text-white text-center tracking-[0.4em] text-base focus:outline-none focus:border-[#d3da0c]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otpCode.length !== 6}
              className="w-full py-3 rounded-xl bg-[#d3da0c] text-black text-sm hover:bg-[#c5cc0b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify and Enter Console
            </button>

            <button
              type="button"
              onClick={() => {
                setTwoFactorToken(null);
                setOtpCode('');
              }}
              className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Back to Admin Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sounditent.com"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/50 border border-white/15 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-black/50 border border-white/15 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#d3da0c] text-black text-sm hover:bg-[#c5cc0b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Sign In to Admin Console
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-white/10 text-center">
          <p className="text-[0.6875rem] text-gray-500">
            Session isolated to Admin Console · Role-based access control enforced
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
