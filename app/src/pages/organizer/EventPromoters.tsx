import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Users, Plus, Copy, Check, Loader2, Share2, Trash2,
  QrCode, TrendingUp, Eye, DollarSign, Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { WEB_ORIGIN } from '@/lib/appUrl';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface EventPromoter {
  id: number;
  event_id: number;
  promoter_id: number;
  referral_code: string;
  commission_rate: number | null;
  discount_percent: number | null;
  max_discount_amount: number | null;
  status: string;
  assigned_at: string;
  clicks: number;
  conversions: number;
  tickets_sold: number;
  revenue_generated: number;
  commission_earned: number;
  promoter_name: string | null;
  promoter_avatar: string | null;
}

interface PromoterSettings {
  promoter_enabled: boolean;
  default_commission_rate: number;
  default_discount_percent: number;
  max_discount_amount: number | null;
}

export default function EventPromoters() {
  const { id: eventId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = localStorage.getItem('auth-token') || localStorage.getItem('token');

  const [promoters, setPromoters] = useState<EventPromoter[]>([]);
  const [settings, setSettings] = useState<PromoterSettings>({
    promoter_enabled: false,
    default_commission_rate: 10,
    default_discount_percent: 5,
    max_discount_amount: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPromoterUserId, setNewPromoterUserId] = useState('');
  const [newCommissionRate, setNewCommissionRate] = useState('');
  const [newDiscountPercent, setNewDiscountPercent] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');

  useEffect(() => {
    if (eventId) {
      fetchPromoters();
      fetchSettings();
      fetchEventTitle();
    }
  }, [eventId]);

  const fetchEventTitle = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setEventTitle(data.title || '');
    } catch {
      // ignore
    }
  };

  const fetchPromoters = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/promoters/events/${eventId}/promoters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setPromoters(data || []);
    } catch {
      toast.error('Failed to load promoters');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/promoters/events/${eventId}/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSettings(data);
    } catch {
      // ignore
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/promoters/events/${eventId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success('Settings saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addPromoter = async () => {
    if (!newPromoterUserId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/promoters/events/${eventId}/promoters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promoter_user_id: parseInt(newPromoterUserId),
          commission_rate: newCommissionRate ? parseFloat(newCommissionRate) : null,
          discount_percent: newDiscountPercent ? parseFloat(newDiscountPercent) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Promoter added');
        setShowAddModal(false);
        setNewPromoterUserId('');
        setNewCommissionRate('');
        setNewDiscountPercent('');
        fetchPromoters();
      } else {
        toast.error(data.detail || 'Failed to add promoter');
      }
    } catch {
      toast.error('Failed to add promoter');
    }
  };

  const removePromoter = async (assignmentId: number) => {
    if (!confirm('Remove this promoter from the event?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/promoters/events/${eventId}/promoters/${assignmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Promoter removed');
        fetchPromoters();
      } else {
        toast.error('Failed to remove promoter');
      }
    } catch {
      toast.error('Failed to remove promoter');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success('Referral code copied');
  };

  const shareUrl = (code: string) => {
    const url = `${WEB_ORIGIN}/events/${eventId}?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Share link copied');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-16 lg:pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard/business/events')}
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Promoter Management</h1>
            <p className="text-gray-400 text-sm">{eventTitle}</p>
          </div>
        </div>

        {/* Settings Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111111] border border-white/10 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Event Referral Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.promoter_enabled}
                onChange={(e) => setSettings({ ...settings, promoter_enabled: e.target.checked })}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500"
              />
              <span className="text-white text-sm">Enable Promoters</span>
            </label>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Default Commission (%)</label>
              <input
                type="number"
                value={settings.default_commission_rate}
                onChange={(e) => setSettings({ ...settings, default_commission_rate: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Default Discount (%)</label>
              <input
                type="number"
                value={settings.default_discount_percent}
                onChange={(e) => setSettings({ ...settings, default_discount_percent: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Max Discount ($)</label>
              <input
                type="number"
                value={settings.max_discount_amount ?? ''}
                onChange={(e) => setSettings({ ...settings, max_discount_amount: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                min="0"
                step="0.01"
                placeholder="No cap"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Settings
            </button>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Promoters', value: promoters.length, icon: Users },
            { label: 'Total Clicks', value: promoters.reduce((s, p) => s + (p.clicks || 0), 0), icon: Eye },
            { label: 'Tickets Sold', value: promoters.reduce((s, p) => s + (p.tickets_sold || 0), 0), icon: TrendingUp },
            { label: 'Commission Earned', value: `$${promoters.reduce((s, p) => s + (p.commission_earned || 0), 0).toFixed(2)}`, icon: DollarSign },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#111111] border border-white/10 rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-purple-400" />
                <span className="text-gray-400 text-xs">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Promoters List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Assigned Promoters</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Promoter
            </button>
          </div>

          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : promoters.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No promoters assigned yet</p>
              <p className="text-gray-500 text-sm mt-1">Add promoters to start your referral program</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Promoter</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Referral Code</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Commission</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Clicks</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Sales</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Revenue</th>
                    <th className="text-right px-6 py-4 text-gray-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {promoters.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {p.promoter_avatar ? (
                            <img src={p.promoter_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <Users className="w-4 h-4 text-purple-400" />
                            </div>
                          )}
                          <span className="text-white text-sm">{p.promoter_name || `Promoter #${p.promoter_id}`}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-purple-500/10 rounded text-purple-400 text-sm">{p.referral_code}</code>
                          <button
                            onClick={() => copyCode(p.referral_code)}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Copy code"
                          >
                            {copiedCode === p.referral_code ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white text-sm">{p.commission_rate ?? settings.default_commission_rate}%</td>
                      <td className="px-6 py-4 text-white text-sm">{p.clicks || 0}</td>
                      <td className="px-6 py-4 text-white text-sm">{p.tickets_sold || 0}</td>
                      <td className="px-6 py-4 text-white text-sm">${(p.revenue_generated || 0).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => shareUrl(p.referral_code)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-purple-400 hover:bg-white/10 transition-colors"
                            title="Copy share link"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removePromoter(p.id)}
                            className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Add Promoter Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-white mb-4">Add Promoter</h3>
            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">User ID *</label>
                <input
                  type="number"
                  value={newPromoterUserId}
                  onChange={(e) => setNewPromoterUserId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                  placeholder="Enter user ID number"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">Custom Commission Rate (%) <span className="text-gray-500">Optional</span></label>
                <input
                  type="number"
                  value={newCommissionRate}
                  onChange={(e) => setNewCommissionRate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                  placeholder="Use event default"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">Custom Discount (%) <span className="text-gray-500">Optional</span></label>
                <input
                  type="number"
                  value={newDiscountPercent}
                  onChange={(e) => setNewDiscountPercent(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                  placeholder="Use event default"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-white/5 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addPromoter}
                className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
              >
                Add Promoter
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
