import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, DollarSign, Users, Eye, Copy, Check, QrCode,
  ChevronRight, Link2, Wallet, ArrowRight, Loader2, Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface PromoterProfile {
  id: number;
  user_id: number;
  referral_code: string;
  total_referrals: number;
  total_conversions: number;
  total_sales: number;
  total_commission: number;
  total_paid_out: number;
  pending_commission: number;
  tier: string;
  commission_rate: number;
  is_active: boolean;
  payment_method: string | null;
  payment_account: string | null;
  payment_name: string | null;
  contact_phone: string | null;
  contact_wechat: string | null;
  created_at: string;
}

interface ReferralStats {
  total_clicks: number;
  total_conversions: number;
  conversion_rate: number;
  total_revenue: number;
  total_commission: number;
  pending_commission: number;
  today_clicks: number;
  today_conversions: number;
  today_revenue: number;
}

interface PromotedEvent {
  id: number;
  event_id: number;
  promoter_id: number;
  referral_code: string;
  commission_rate: number | null;
  discount_percent: number | null;
  status: string;
  clicks: number;
  conversions: number;
  tickets_sold: number;
  revenue_generated: number;
  commission_earned: number;
  promoter_name: string | null;
}

interface Payout {
  id: number;
  amount: number;
  status: string;
  payment_method: string | null;
  payment_account: string | null;
  created_at: string;
}

export default function PromoterDashboard() {
  const { t } = useTranslation();
  const token = localStorage.getItem('auth-token') || localStorage.getItem('token');

  const [profile, setProfile] = useState<PromoterProfile | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [events, setEvents] = useState<PromotedEvent[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('wechat');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawName, setWithdrawName] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'payouts'>('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, statsRes, eventsRes, payoutsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/promoters/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/promoters/me/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/promoters/me/events`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/promoters/me/payouts`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (profileRes.ok) setProfile(await profileRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (payoutsRes.ok) setPayouts(await payoutsRes.json());
    } catch {
      toast.error('Failed to load promoter data');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.referral_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success('Referral code copied');
  };

  const requestWithdrawal = async () => {
    if (!profile || !withdrawAmount) return;
    const amount = parseFloat(withdrawAmount);
    if (amount <= 0 || amount > (profile.pending_commission || 0)) {
      toast.error('Invalid amount');
      return;
    }
    setWithdrawing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/promoters/me/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          payment_method: withdrawMethod,
          payment_account: withdrawAccount,
          payment_name: withdrawName,
        }),
      });
      if (res.ok) {
        toast.success('Withdrawal request submitted');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Withdrawal failed');
      }
    } catch {
      toast.error('Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] pt-16 lg:pt-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-16 lg:pt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Promoter Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Track your referrals, earnings, and payouts</p>
          </div>
          {profile && (
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <span className="text-purple-400 text-xs uppercase font-semibold">{profile.tier}</span>
              </div>
              <button
                onClick={() => setShowWithdrawModal(true)}
                disabled={!profile.pending_commission || profile.pending_commission <= 0}
                className="px-4 py-2 bg-[#d3da0c] text-black rounded-lg text-sm font-semibold hover:bg-[#e0e730] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Withdraw
              </button>
            </div>
          )}
        </div>

        {/* Referral Code Card */}
        {profile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-500/20 to-[#d3da0c]/10 border border-purple-500/20 rounded-2xl p-6 mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Your Referral Code</p>
                <div className="flex items-center gap-3">
                  <code className="text-2xl font-bold text-white tracking-wider">{profile.referral_code}</code>
                  <button
                    onClick={copyReferralCode}
                    className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-gray-400 text-xs">Pending Commission</p>
                  <p className="text-xl font-bold text-[#d3da0c]">${(profile.pending_commission || 0).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">Total Earned</p>
                  <p className="text-xl font-bold text-white">${(profile.total_commission || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Clicks', value: stats.total_clicks, icon: Eye, color: 'text-blue-400' },
              { label: 'Conversions', value: stats.total_conversions, icon: TrendingUp, color: 'text-green-400' },
              { label: 'Conversion Rate', value: `${stats.conversion_rate}%`, icon: Share2, color: 'text-purple-400' },
              { label: 'Total Revenue', value: `$${stats.total_revenue.toFixed(2)}`, icon: DollarSign, color: 'text-[#d3da0c]' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#111111] border border-white/10 rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-gray-400 text-xs">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
          {(['overview', 'events', 'payouts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Today's Activity */}
            {stats && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#111111] border border-white/10 rounded-2xl p-6"
              >
                <h3 className="text-lg font-semibold text-white mb-4">Today's Activity</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-2xl font-bold text-white">{stats.today_clicks}</p>
                    <p className="text-gray-400 text-xs mt-1">Clicks</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-2xl font-bold text-white">{stats.today_conversions}</p>
                    <p className="text-gray-400 text-xs mt-1">Sales</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-2xl font-bold text-[#d3da0c]">${stats.today_revenue.toFixed(2)}</p>
                    <p className="text-gray-400 text-xs mt-1">Revenue</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Recent Events */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-[#111111] border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Your Active Events</h3>
              {events.length === 0 ? (
                <div className="text-center py-8">
                  <Share2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No events assigned yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                      <div>
                        <p className="text-white font-medium text-sm">{ev.promoter_name || `Event #${ev.event_id}`}</p>
                        <p className="text-gray-500 text-xs mt-0.5">Code: {ev.referral_code}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">{ev.clicks} clicks</span>
                        <span className="text-green-400">${(ev.commission_earned || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {activeTab === 'events' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden"
          >
            {events.length === 0 ? (
              <div className="p-12 text-center">
                <Share2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No events assigned yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Event</th>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Code</th>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Clicks</th>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Sales</th>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Revenue</th>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-white text-sm">{ev.promoter_name || `Event #${ev.event_id}`}</td>
                        <td className="px-6 py-4">
                          <code className="px-2 py-1 bg-purple-500/10 rounded text-purple-400 text-sm">{ev.referral_code}</code>
                        </td>
                        <td className="px-6 py-4 text-white text-sm">{ev.clicks || 0}</td>
                        <td className="px-6 py-4 text-white text-sm">{ev.tickets_sold || 0}</td>
                        <td className="px-6 py-4 text-white text-sm">${(ev.revenue_generated || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-[#d3da0c] text-sm font-medium">${(ev.commission_earned || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'payouts' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden"
          >
            {payouts.length === 0 ? (
              <div className="p-12 text-center">
                <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No payouts yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Amount</th>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Status</th>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Method</th>
                      <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-white text-sm font-medium">${p.amount.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            p.status === 'paid' ? 'bg-green-500/10 text-green-400' :
                            p.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">{p.payment_method || '-'}</td>
                        <td className="px-6 py-4 text-gray-400 text-sm">{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-white mb-2">Request Withdrawal</h3>
            <p className="text-gray-400 text-sm mb-4">
              Available: <span className="text-[#d3da0c] font-semibold">${(profile.pending_commission || 0).toFixed(2)}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">Amount *</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder="Enter amount"
                  min="1"
                  max={profile.pending_commission || 0}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">Payment Method *</label>
                <select
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                >
                  <option value="wechat">WeChat Pay</option>
                  <option value="alipay">Alipay</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">Account / Phone *</label>
                <input
                  type="text"
                  value={withdrawAccount}
                  onChange={(e) => setWithdrawAccount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder="Account number or phone"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">Account Holder Name *</label>
                <input
                  type="text"
                  value={withdrawName}
                  onChange={(e) => setWithdrawName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder="Full name"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 py-3 bg-white/5 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={requestWithdrawal}
                disabled={withdrawing || !withdrawAmount || !withdrawAccount || !withdrawName}
                className="flex-1 py-3 bg-[#d3da0c] text-black rounded-xl font-medium hover:bg-[#e0e730] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {withdrawing && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Request
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
