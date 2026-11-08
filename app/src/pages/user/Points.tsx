/**
 * My Points (/points)
 * Balance hero, Earn Points / Use Points cards (sheets), and Points History.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Coins,
  Trophy,
  Ticket,
  ChevronRight,
  Loader2,
  X,
  Calendar,
  Share2,
  Sparkles,
  Users,
  ShieldCheck,
  Gift,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';

interface PointsData {
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  points_to_cny_rate: number;
  earning_rules: { action_key: string; title: string; description: string; points: number; icon?: string }[];
  rewards: { id: number; title: string; description?: string; points_cost: number; reward_type: string; discount_amount: number; can_redeem: boolean }[];
  transactions: { id: number; amount: number; tx_type: string; action_key: string; title: string; description?: string; created_at: string }[];
}

const ruleIcon = (icon?: string) => {
  switch (icon) {
    case 'ticket': return Ticket;
    case 'calendar': return Calendar;
    case 'share': return Share2;
    case 'sparkles': return Sparkles;
    case 'users': return Users;
    case 'shield': return ShieldCheck;
    default: return Coins;
  }
};

const txIcon = (key: string) => {
  if (key.includes('checkin') || key.includes('event')) return Calendar;
  if (key.includes('share')) return Share2;
  if (key.includes('ticket')) return Ticket;
  if (key.includes('invite')) return Users;
  if (key.includes('redeem')) return Gift;
  return Coins;
};

const Points = () => {
  const navigate = useNavigate();
  const { session, isAuthenticated } = useAuthStore();
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<'earn' | 'use' | 'history' | null>(null);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [lastVoucher, setLastVoucher] = useState<string | null>(null);

  const load = async () => {
    if (!session?.access_token) {
      setData({
        balance: 0,
        lifetime_earned: 0,
        lifetime_redeemed: 0,
        points_to_cny_rate: 10,
        earning_rules: [
          { action_key: 'event_checkin', title: 'Attend an Event', description: 'Check in at any official Sound It event', points: 500, icon: 'calendar' },
          { action_key: 'ticket_purchase', title: 'Purchase Tickets', description: 'Earn points on every ticket order', points: 250, icon: 'ticket' },
          { action_key: 'share_event', title: 'Share an Event', description: 'Share events with friends in the community', points: 50, icon: 'share' },
          { action_key: 'post_reel', title: 'Upload a Reel', description: 'Share event recaps and short videos', points: 100, icon: 'sparkles' },
        ],
        rewards: [],
        transactions: [],
      });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/points/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const redeem = async (rewardId: number) => {
    if (!session?.access_token) return;
    setRedeemingId(rewardId);
    try {
      const res = await fetch(`${API_BASE_URL}/points/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reward_id: rewardId }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.detail || 'Redemption failed');
      setLastVoucher(out.voucher_code);
      toast.success(`Redeemed! Code: ${out.voucher_code}`);
      window.dispatchEvent(new Event('notifications-updated'));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRedeemingId(null);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-white dark:bg-[#020B00] text-[#020b00] dark:text-white pb-24 transition-colors duration-200">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020B00]/95 backdrop-blur-xl border-b border-black/10 dark:border-white/10 safe-area-pt">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold tracking-tight">My Points</h1>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center"><Loader2 className="w-7 h-7 text-[#d3da0c] animate-spin" /></div>
      ) : (
        <div className="max-w-xl mx-auto px-4 pt-6 space-y-5">
          {/* Balance hero */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#d3da0c]/15 dark:bg-[#d3da0c]/10 border border-[#d3da0c]/40 dark:border-[#d3da0c]/30 flex items-center justify-center shadow-[0_0_40px_rgba(211,218,12,0.25)]">
              <Coins className="w-10 h-10 text-[#8a8f04] dark:text-[#d3da0c]" />
            </div>
            <p className="text-4xl font-black mt-4 tracking-tight">
              {(data?.balance || 0).toLocaleString()} <span className="text-[#8a8f04] dark:text-[#d3da0c]">pts</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Your Points Balance</p>
            <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-gray-500">
              <span>Earned {(data?.lifetime_earned || 0).toLocaleString()}</span>
              <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600" />
              <span>Redeemed {(data?.lifetime_redeemed || 0).toLocaleString()}</span>
            </div>
          </motion.div>

          {/* Action cards */}
          <div className="space-y-3">
            {[
              { key: 'earn' as const, icon: Trophy, title: 'Earn Points', sub: 'Complete activities & engage' },
              { key: 'use' as const, icon: Ticket, title: 'Use Points', sub: 'Pay for tickets, get discounts & more' },
            ].map(card => (
              <button
                key={card.key}
                onClick={() => setSheet(card.key)}
                className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-neutral-50 dark:bg-[#0a1408] border border-black/10 dark:border-white/10 hover:border-[#d3da0c] transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-[#d3da0c]/15 dark:bg-[#d3da0c]/10 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
                  <card.icon className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#020b00] dark:text-white">{card.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{card.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            ))}
          </div>

          {lastVoucher && (
            <div className="p-4 rounded-2xl bg-[#d3da0c]/15 dark:bg-[#d3da0c]/10 border border-[#d3da0c]/40 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-700 dark:text-gray-300">Your latest reward code</p>
                <p className="text-base font-black text-[#8a8f04] dark:text-[#d3da0c] tracking-wider">{lastVoucher}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(lastVoucher); toast.success('Code copied'); }}
                className="px-3 h-8 rounded-full bg-[#d3da0c] text-black text-xs font-bold"
              >
                Copy
              </button>
            </div>
          )}

          {/* History */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold text-[#020b00] dark:text-white">Points History</h3>
              {(data?.transactions?.length || 0) > 5 && (
                <button onClick={() => setSheet('history')} className="text-xs font-bold text-[#8a8f04] dark:text-[#d3da0c] flex items-center gap-0.5">
                  See all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="rounded-2xl bg-neutral-50 dark:bg-[#0a1408] border border-black/10 dark:border-white/10 divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {(data?.transactions || []).slice(0, 5).map(tx => {
                const Icon = txIcon(tx.action_key);
                const positive = tx.amount >= 0;
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3.5">
                    <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#8a8f04] dark:text-[#d3da0c]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#020b00] dark:text-white truncate">{tx.title}</p>
                      <p className="text-[11px] text-gray-500">{fmtDate(tx.created_at)}</p>
                    </div>
                    <span className={`text-sm font-extrabold ${positive ? 'text-[#8a8f04] dark:text-[#d3da0c]' : 'text-red-500 dark:text-red-400'}`}>
                      {positive ? '+' : ''}{tx.amount.toLocaleString()} pts
                    </span>
                  </div>
                );
              })}
              {(data?.transactions || []).length === 0 && (
                <p className="text-xs text-gray-500 text-center py-8">No points activity yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sheets */}
      <AnimatePresence>
        {sheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSheet(null)}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a1408] border-t border-white/15 rounded-t-3xl max-h-[80vh] flex flex-col safe-area-pb"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-extrabold">
                  {sheet === 'earn' ? 'Ways to Earn Points' : sheet === 'use' ? 'Use Your Points' : 'All Points Activity'}
                </h3>
                <button onClick={() => setSheet(null)} className="p-1.5 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {sheet === 'earn' && (data?.earning_rules || []).map(rule => {
                  const Icon = ruleIcon(rule.icon);
                  return (
                    <div key={rule.action_key} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                      <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-[#d3da0c]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{rule.title}</p>
                        <p className="text-[11px] text-gray-400">{rule.description}</p>
                      </div>
                      <span className="text-sm font-extrabold text-[#d3da0c] shrink-0">+{rule.points}</span>
                    </div>
                  );
                })}

                {sheet === 'use' && (
                  <>
                    <div className="p-3.5 rounded-2xl bg-[#d3da0c]/10 border border-[#d3da0c]/30 text-xs text-gray-200">
                      Apply points at ticket checkout: every {data?.points_to_cny_rate || 25} pts = ¥1 off.
                    </div>
                    {(data?.rewards || []).map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                          <Gift className="w-5 h-5 text-[#d3da0c]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold">{r.title}</p>
                          <p className="text-[11px] text-gray-400">{r.points_cost.toLocaleString()} pts</p>
                        </div>
                        <button
                          onClick={() => redeem(r.id)}
                          disabled={!r.can_redeem || redeemingId === r.id}
                          className="px-3.5 h-8 rounded-full bg-[#d3da0c] text-black text-xs font-extrabold disabled:opacity-40 flex items-center gap-1"
                        >
                          {redeemingId === r.id && <Loader2 className="w-3 h-3 animate-spin" />}
                          Redeem
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => { setSheet(null); navigate('/events'); }}
                      className="w-full h-11 rounded-full bg-white/10 text-sm font-bold"
                    >
                      Browse Events
                    </button>
                  </>
                )}

                {sheet === 'history' && (data?.transactions || []).map(tx => {
                  const positive = tx.amount >= 0;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03]">
                      {positive ? <ArrowUpRight className="w-4 h-4 text-[#d3da0c]" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.title}</p>
                        <p className="text-[11px] text-gray-500 truncate">{tx.description || fmtDate(tx.created_at)}</p>
                      </div>
                      <span className={`text-sm font-extrabold ${positive ? 'text-[#d3da0c]' : 'text-red-400'}`}>
                        {positive ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Points;
