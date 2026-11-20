import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';

export default function SubscriptionTrialBanner({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const { profile, session } = useAuthStore();
  const {
    hasSubscription,
    daysRemaining,
    isTrial,
    isTrialExpired,
    checkSubscription,
  } = useSubscriptionStore();

  const role = (profile?.role_type || profile?.role || '').toLowerCase();
  const isCreatorRole = ['business', 'organizer', 'vendor', 'artist', 'dj'].includes(role);
  const isVerified = Boolean(profile?.is_verified || (profile as any)?.verification_badge);
  const isAdmin = ['admin', 'super_admin'].includes(role);

  useEffect(() => {
    if (session?.access_token && isCreatorRole && !isVerified && !isAdmin) {
      checkSubscription(session.access_token);
    }
  }, [session?.access_token, isCreatorRole, isVerified, isAdmin, checkSubscription]);

  // Verified users and admins have perpetual access without needing a trial banner
  if (!isCreatorRole || isVerified || isAdmin) {
    return null;
  }

  // Active Trial State
  if (hasSubscription && isTrial) {
    const days = daysRemaining ?? 30;
    const isUrgent = days <= 5;

    return (
      <div
        className={`relative overflow-hidden rounded-2xl border ${
          isUrgent
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            : 'border-[#d3da0c]/30 bg-gradient-to-r from-[#0d1f0d] via-[#112411] to-[#0d1a0d] text-white'
        } p-4 sm:p-4.5 shadow-lg backdrop-blur-md transition-all ${className}`}
      >
        <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-[#d3da0c]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/20 border border-[#d3da0c]/40 flex items-center justify-center flex-shrink-0 text-[#d3da0c]">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#d3da0c]/20 text-[#d3da0c] border border-[#d3da0c]/30">
                  1-Month Free Trial Active
                </span>
                <span className="text-xs text-gray-300 font-medium">
                  {days > 0 ? `${days} day${days === 1 ? '' : 's'} remaining` : 'Ending today'}
                </span>
              </div>
              <p className="text-sm font-semibold text-white mt-1">
                Full Premium Features Unlocked
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Enjoy unlimited event creation, table reservations, booking deposits, and listings.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/subscriptions')}
            className="self-start sm:self-center px-4 py-2 rounded-xl bg-[#d3da0c] hover:bg-[#c2c80b] active:scale-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md flex-shrink-0"
          >
            <span>View Plans</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    );
  }

  // Trial Expired / No Active Subscription State
  if (!hasSubscription) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-[#211105] via-[#2a1708] to-[#1c0c03] p-4 sm:p-4.5 text-white shadow-xl backdrop-blur-md transition-all ${className}`}
      >
        <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Free Trial Ended
                </span>
                <span className="text-xs text-amber-200/80 font-medium">
                  Feature Limits In Effect
                </span>
              </div>
              <p className="text-sm font-semibold text-white mt-1">
                Subscribe to Unlock Full Features
              </p>
              <p className="text-xs text-gray-300 mt-0.5">
                Subscribe now to create unlimited events, receive booking deposits, and manage tables & booths.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/subscriptions')}
            className="self-start sm:self-center px-4 py-2 rounded-xl bg-[#d3da0c] hover:bg-[#c2c80b] active:scale-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md flex-shrink-0"
          >
            <span>Subscribe Now</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
