import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Activity,
  Zap,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Compass,
} from 'lucide-react';

interface Stats {
  total_activities_tracked: number;
  total_user_interests: number;
  total_scheduled: number;
  total_delivered: number;
  total_pending: number;
  total_failed: number;
  total_skipped: number;
  delivery_rate_percent: number;
  promotions_paused: boolean;
  top_interest_categories: { category: string; users_count: number; avg_score: number }[];
}

interface Rule {
  id: number;
  rule_key: string;
  name: string;
  description: string;
  is_active: boolean;
  category: string;
  priority: string;
  cooldown_hours: number;
  config: any;
}

interface LogItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  scheduled_for_utc: string;
  sent_at: string | null;
  error_reason: string | null;
  retry_count: number;
  created_at: string;
}

const SmartNotificationAutomation: React.FC = () => {
  const { session } = useAuthStore();
  const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const [stats, setStats] = useState<Stats | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [togglingRule, setTogglingRule] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/smart-notifications/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Error fetching smart notif stats:', e);
    }
  }, [token]);

  const fetchRules = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/smart-notifications/rules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (e) {
      console.error('Error fetching smart rules:', e);
    }
  }, [token]);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      const url = new URL(`${API_BASE_URL}/admin/smart-notifications/logs`);
      if (statusFilter) url.searchParams.append('status', statusFilter);
      url.searchParams.append('limit', '30');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items || []);
      }
    } catch (e) {
      console.error('Error fetching logs:', e);
    }
  }, [token, statusFilter]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchRules(), fetchLogs()]);
    setLoading(false);
  }, [fetchStats, fetchRules, fetchLogs]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleToggleRule = async (ruleKey: string, currentActive: boolean) => {
    setTogglingRule(ruleKey);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/smart-notifications/rules/${ruleKey}/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.rule_key === ruleKey ? { ...r, is_active: !currentActive } : r))
        );
        toast.success(`Rule "${ruleKey}" ${!currentActive ? 'enabled' : 'disabled'}`);
      } else {
        toast.error('Failed to toggle rule');
      }
    } catch {
      toast.error('Network error toggling rule');
    } finally {
      setTogglingRule(null);
    }
  };

  const handlePausePromotions = async (shouldPause: boolean) => {
    setPausing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/smart-notifications/pause-promotions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paused: shouldPause }),
      });
      if (res.ok) {
        toast.success(shouldPause ? 'All promotional notifications PAUSED' : 'Promotional notifications RESUMED');
        await fetchStats();
      } else {
        toast.error('Failed to update promotion status');
      }
    } catch {
      toast.error('Network error updating pause status');
    } finally {
      setPausing(false);
    }
  };

  const handleRunWorkerNow = async () => {
    setCycleRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/smart-notifications/run-worker-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const delivered = data.cycle_result?.delivered || 0;
        toast.success(`Worker cycle executed: ${delivered} delivered`);
        await refreshAll();
      } else {
        toast.error('Worker execution failed');
      }
    } catch {
      toast.error('Network error executing worker cycle');
    } finally {
      setCycleRunning(false);
    }
  };

  const handleRetryNotification = async (id: number) => {
    setRetryingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/smart-notifications/retry/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(`Notification #${id} queued for immediate retry`);
        await refreshAll();
      } else {
        toast.error('Failed to retry notification');
      }
    } catch {
      toast.error('Network error retrying notification');
    } finally {
      setRetryingId(null);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#d3da0c] mb-3" />
        <p className="text-sm">Loading Smart Notification Engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / System Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#071205] border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 border border-[#d3da0c]/30 flex items-center justify-center text-[#d3da0c]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              Automated Intelligence Engine
              <span className="text-[0.625rem] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              Autonomous behaviour-based triggers, dynamic interest scoring, and time zone delivery.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {stats?.promotions_paused ? (
            <button
              onClick={() => handlePausePromotions(false)}
              disabled={pausing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all shadow-md"
            >
              {pausing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Resume Promotions
            </button>
          ) : (
            <button
              onClick={() => handlePausePromotions(true)}
              disabled={pausing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium text-xs transition-all"
            >
              {pausing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
              Pause Promotions
            </button>
          )}

          <button
            onClick={handleRunWorkerNow}
            disabled={cycleRunning}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#d3da0c] hover:bg-[#c2c90b] text-black font-bold text-xs transition-all shadow-md active:scale-95"
          >
            {cycleRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Run Worker Cycle
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-[#0c1a08] border border-white/5">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Interactions Tracked</span>
            <Activity className="w-4 h-4 text-[#d3da0c]" />
          </div>
          <div className="text-2xl font-black text-white">
            {stats?.total_activities_tracked?.toLocaleString() || 0}
          </div>
          <div className="text-[0.6875rem] text-gray-400 mt-1">Weighted behaviour events</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1a08] border border-white/5">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Interests Modeled</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {stats?.total_user_interests?.toLocaleString() || 0}
          </div>
          <div className="text-[0.6875rem] text-gray-400 mt-1">21-day decay weighted</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1a08] border border-white/5">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Delivered via Engine</span>
            <CheckCircle2 className="w-4 h-4 text-[#d3da0c]" />
          </div>
          <div className="text-2xl font-black text-white">
            {stats?.total_delivered?.toLocaleString() || 0}
          </div>
          <div className="text-[0.6875rem] text-emerald-400 mt-1">
            {stats?.delivery_rate_percent || 100}% success rate
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1a08] border border-white/5">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Pending In Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {stats?.total_pending?.toLocaleString() || 0}
          </div>
          <div className="text-[0.6875rem] text-gray-400 mt-1">
            {stats?.total_failed ? `${stats.total_failed} failed` : 'Zero errors'}
          </div>
        </div>
      </div>

      {/* Top Categories Pill Cloud */}
      {stats?.top_interest_categories && stats.top_interest_categories.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#071205] border border-white/10">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-[#d3da0c]" />
            Trending Platform Interests (User Count & Average Score)
          </h4>
          <div className="flex flex-wrap gap-2">
            {stats.top_interest_categories.map((c) => (
              <div
                key={c.category}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
              >
                <span className="font-semibold capitalize">{c.category}</span>
                <span className="px-1.5 py-0.5 rounded bg-[#d3da0c]/20 text-[#d3da0c] font-mono text-[0.625rem]">
                  {c.users_count} users (avg {c.avg_score})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trigger Rules Matrix */}
      <div className="p-5 rounded-2xl bg-[#071205] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#d3da0c]" />
            Automated Trigger Rules Configuration
          </h3>
          <span className="text-xs text-gray-400">
            {rules.filter((r) => r.is_active).length} of {rules.length} Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rules.map((rule) => (
            <div
              key={rule.rule_key}
              className={`p-4 rounded-xl border transition-all ${
                rule.is_active
                  ? 'bg-black/50 border-white/15'
                  : 'bg-black/20 border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{rule.name}</span>
                    <span
                      className={`text-[0.625rem] font-mono px-2 py-0.5 rounded-full uppercase ${
                        rule.priority === 'critical'
                          ? 'bg-rose-500/20 text-rose-300'
                          : rule.priority === 'high'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      {rule.priority}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{rule.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[0.6875rem] text-gray-500 font-mono">
                    <span>Cooldown: {rule.cooldown_hours}h</span>
                    <span>•</span>
                    <span className="capitalize">{rule.category}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleRule(rule.rule_key, rule.is_active)}
                  disabled={togglingRule === rule.rule_key}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                    rule.is_active ? 'bg-[#d3da0c]' : 'bg-white/20'
                  }`}
                  aria-label="Toggle rule"
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-black transform transition-transform ${
                      rule.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue & Dispatch Audit Log */}
      <div className="p-5 rounded-2xl bg-[#071205] border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#d3da0c]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Smart Notification Queue & Audit Log
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#d3da0c]"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent (Delivered)</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped (Constraints)</option>
            </select>

            <button
              onClick={fetchLogs}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
              aria-label="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No scheduled notification records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 font-mono">
                  <th className="pb-2">User</th>
                  <th className="pb-2">Title & Message</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Priority</th>
                  <th className="pb-2">Scheduled (UTC)</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 font-mono text-gray-300">#{log.user_id}</td>
                    <td className="py-2.5 max-w-xs pr-4">
                      <div className="font-semibold text-white truncate">{log.title}</div>
                      <div className="text-[0.6875rem] text-gray-400 truncate">{log.message}</div>
                      {log.error_reason && (
                        <div className="text-[0.625rem] text-rose-400 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{log.error_reason}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300 capitalize text-[0.625rem]">
                        {log.category}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`text-[0.625rem] font-mono px-1.5 py-0.5 rounded uppercase ${
                          log.priority === 'critical'
                            ? 'text-rose-400 bg-rose-500/10'
                            : log.priority === 'high'
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-gray-400 bg-white/5'
                        }`}
                      >
                        {log.priority}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-400 font-mono text-[0.6875rem]">
                      {log.scheduled_for_utc ? new Date(log.scheduled_for_utc).toLocaleString() : 'Immediate'}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-medium ${
                          log.status === 'sent'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : log.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300'
                            : log.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {log.status === 'failed' && (
                        <button
                          onClick={() => handleRetryNotification(log.id)}
                          disabled={retryingId === log.id}
                          className="px-2 py-1 rounded bg-[#d3da0c]/20 hover:bg-[#d3da0c]/30 text-[#d3da0c] text-[0.625rem] font-bold transition-all"
                        >
                          {retryingId === log.id ? (
                            <Loader2 className="w-3 h-3 animate-spin inline" />
                          ) : (
                            <RotateCcw className="w-3 h-3 inline mr-1" />
                          )}
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartNotificationAutomation;
