import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MailX, CheckCircle2, Loader2, RefreshCw, Settings, Home, ShieldCheck, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

type UnsubScope = 'all' | 'marketing' | 'newsletter';

interface UnsubState {
  status: 'idle' | 'loading' | 'unsubscribed' | 'subscribed' | 'error';
  message: string;
  email: string;
  scope: UnsubScope;
  emailEnabled?: boolean;
  marketingEnabled?: boolean;
  newsletterActive?: boolean;
}

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = (searchParams.get('email') || '').trim().toLowerCase();
  const token = (searchParams.get('token') || '').trim();
  const rawScope = (searchParams.get('scope') || 'all').trim().toLowerCase();
  const initialScope: UnsubScope =
    rawScope === 'marketing' || rawScope === 'newsletter' ? rawScope : 'all';

  const [manualEmail, setManualEmail] = useState(initialEmail);
  const [selectedScope, setSelectedScope] = useState<UnsubScope>(initialScope);
  const [state, setState] = useState<UnsubState>({
    status: initialEmail ? 'loading' : 'idle',
    message: '',
    email: initialEmail,
    scope: initialScope,
  });

  const autoRanRef = useRef(false);

  const performUnsubscribe = async (targetEmail: string, scope: UnsubScope) => {
    const clean = targetEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        message: 'Please enter a valid email address.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading', email: clean, scope }));
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: clean,
          token: token || undefined,
          scope,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || 'Could not process your unsubscribe request.');
      }
      setState({
        status: 'unsubscribed',
        message:
          data?.message ||
          (scope === 'all'
            ? 'You have been unsubscribed from all non-essential Sound It emails.'
            : 'You have been unsubscribed from Sound It marketing and newsletter emails.'),
        email: clean,
        scope,
        emailEnabled: data?.email_enabled,
        marketingEnabled: data?.marketing_enabled,
        newsletterActive: data?.newsletter_active,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        message: (e as Error).message || 'Something went wrong. Please try again.',
      }));
    }
  };

  const performResubscribe = async () => {
    if (!state.email || !token) return;
    setState((prev) => ({ ...prev, status: 'loading' }));
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/resubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: state.email,
          token,
          scope: state.scope,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || 'Failed to re-subscribe.');
      }
      setState({
        status: 'subscribed',
        message: data?.message || 'You have been re-subscribed to Sound It emails.',
        email: state.email,
        scope: state.scope,
        emailEnabled: data?.email_enabled,
        marketingEnabled: data?.marketing_enabled,
        newsletterActive: data?.newsletter_active,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        message: (e as Error).message || 'Could not re-subscribe.',
      }));
    }
  };

  useEffect(() => {
    if (initialEmail && !autoRanRef.current) {
      autoRanRef.current = true;
      void performUnsubscribe(initialEmail, initialScope);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-dvh bg-[#020b00] text-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#0f140d] border border-[#1f261e] rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <Link to="/" className="inline-block mb-4">
            <img
              src="/brand-logo-dark.png"
              alt="Sound It"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d3da0c]/15 text-[#d3da0c] text-[0.6875rem] font-bold uppercase tracking-wider mb-3">
            Email Preferences
          </span>
        </div>

        {/* Loading State */}
        {state.status === 'loading' && (
          <div className="py-8 flex flex-col items-center text-center">
            <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin mb-4" />
            <h1 className="text-lg font-bold mb-1">Updating your email preferences...</h1>
            <p className="text-sm text-gray-400">Please wait a moment.</p>
          </div>
        )}

        {/* Unsubscribed Confirmation */}
        {state.status === 'unsubscribed' && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-[#22c55e]" />
            </div>
            <h1 className="text-xl font-bold mb-2">You&apos;re Unsubscribed</h1>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">{state.message}</p>
            {state.email && (
              <div className="inline-block px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-[#d3da0c] mb-5 break-all">
                {state.email}
              </div>
            )}

            {/* Granular quick switch */}
            <div className="bg-black/30 border border-[#1f261e] rounded-2xl p-4 text-left space-y-2.5 mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Adjust Preference</p>
              <button
                type="button"
                onClick={() => performUnsubscribe(state.email, 'all')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  state.scope === 'all'
                    ? 'bg-[#d3da0c]/15 border-[#d3da0c]/50 text-[#d3da0c]'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                Unsubscribe from all non-essential emails
              </button>
              <button
                type="button"
                onClick={() => performUnsubscribe(state.email, 'marketing')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  state.scope !== 'all'
                    ? 'bg-[#d3da0c]/15 border-[#d3da0c]/50 text-[#d3da0c]'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                Unsubscribe from marketing &amp; newsletters only
              </button>
            </div>

            {token && (
              <button
                type="button"
                onClick={performResubscribe}
                className="w-full mb-3 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Clicked by mistake? Re-subscribe
              </button>
            )}
          </div>
        )}

        {/* Re-subscribed Confirmation */}
        {state.status === 'subscribed' && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-[#d3da0c]" />
            </div>
            <h1 className="text-xl font-bold mb-2">Welcome Back!</h1>
            <p className="text-sm text-gray-300 leading-relaxed mb-4">{state.message}</p>
            <button
              type="button"
              onClick={() => performUnsubscribe(state.email, 'all')}
              className="w-full mb-3 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 transition-colors"
            >
              <MailX className="w-4 h-4" />
              Unsubscribe again
            </button>
          </div>
        )}

        {/* Manual / Idle Form */}
        {(state.status === 'idle' || state.status === 'error') && (
          <div>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                <MailX className="w-6 h-6 text-red-400" />
              </div>
              <h1 className="text-xl font-bold mb-1">Unsubscribe from Emails</h1>
              <p className="text-sm text-gray-400">
                Enter your email address below to opt out of Sound It updates and promotional emails.
              </p>
            </div>

            {state.status === 'error' && state.message && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{state.message}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void performUnsubscribe(manualEmail, selectedScope);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-black/40 border border-[#1f261e] rounded-xl text-white text-sm placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400">Unsubscribe Scope</label>
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-black/30 border border-[#1f261e] cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={selectedScope === 'all'}
                    onChange={() => setSelectedScope('all')}
                    className="mt-0.5 accent-[#d3da0c]"
                  />
                  <span className="text-xs text-gray-300">
                    <strong className="text-white block">All non-essential emails</strong>
                    Stop newsletters, event updates, announcements, and email notifications.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-black/30 border border-[#1f261e] cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={selectedScope !== 'all'}
                    onChange={() => setSelectedScope('marketing')}
                    className="mt-0.5 accent-[#d3da0c]"
                  />
                  <span className="text-xs text-gray-300">
                    <strong className="text-white block">Marketing &amp; newsletters only</strong>
                    Keep account, booking, and message email notifications active.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] bg-[#d3da0c] text-black font-bold text-sm rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#d3da0c]/20"
              >
                Unsubscribe
              </button>
            </form>
          </div>
        )}

        {/* Compliance note & Footer links */}
        <div className="mt-6 pt-5 border-t border-[#1f261e] space-y-3">
          <div className="flex items-start gap-2 text-[0.7rem] text-gray-400 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#d3da0c] shrink-0 mt-0.5" />
            <span>
              Essential transactional emails (such as login verification codes, password resets, and purchased event QR tickets) will still be delivered if you have an active Sound It account.
            </span>
          </div>
          <div className="flex items-center justify-center gap-4 pt-1 text-xs">
            <Link to="/settings/notifications" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-[#d3da0c] transition-colors">
              <Settings className="w-3.5 h-3.5" />
              Notification Settings
            </Link>
            <span className="text-gray-700">•</span>
            <Link to="/" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-[#d3da0c] transition-colors">
              <Home className="w-3.5 h-3.5" />
              Back to Sound It
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Unsubscribe;
