import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Activity,
  Bot,
  Calendar,
  Check,
  CheckCheck,
  Clock,
  Compass,
  Eye,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

interface AgentMetric {
  preview_drafts: number;
  sent: number;
  opened: number;
  clicked: number;
  open_rate_pct: number;
  ctr_pct: number;
}

interface AgentItem {
  agent_key: string;
  name: string;
  description: string;
  is_enabled: boolean;
  mode: 'preview' | 'autopilot';
  default_send_hour: number;
  max_per_week: number;
  cooldown_days: number;
  channels: string[];
  last_run_at: string | null;
  last_run_summary: Record<string, any> | null;
  metrics: AgentMetric;
}

interface OverviewResponse {
  global_mode: 'preview' | 'autopilot' | 'mixed';
  copywriter: {
    mode: string;
    provider: string;
    model: string;
    label: string;
    zero_key: boolean;
  };
  inventory_health: {
    upcoming_approved_events: number;
    event_radar_silence_active: boolean;
    spotlight_ready_artists: number;
    spotlight_ready_vendors: number;
    incomplete_providers: {
      artist: number;
      business: number;
      vendor: number;
    };
    total_incomplete_providers: number;
  };
  telemetry: {
    pending_preview_drafts: number;
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    overall_ctr_pct: number;
    overall_open_rate_pct: number;
    learned_timing_users: number;
    auto_throttled_users: number;
  };
  agents: AgentItem[];
}

interface DraftItem {
  id: number;
  agent_key: string;
  user_id: number;
  recipient_name: string;
  recipient_email: string | null;
  recipient_role: string | null;
  city: string | null;
  language: string;
  angle_key: string;
  entity_type: string | null;
  title: string;
  message: string;
  action_url: string | null;
  reasoning: string | null;
  channels: string[];
  generated_by: string;
  local_send_hour: number | null;
  scheduled_for_utc: string | null;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string | null;
}

const AGENT_ICONS: Record<string, React.ElementType> = {
  event_radar: Calendar,
  talent_spotlight: Compass,
  provider_coach: UserCheck,
  click_optimizer: TrendingUp,
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  queued: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  sent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  opened: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  clicked: 'bg-[#d3da0c]/20 text-[#d3da0c] border-[#d3da0c]/40',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const AutonomousAgentsPanel: React.FC = () => {
  const { session } = useAuthStore();
  const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('draft');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [switchingGlobal, setSwitchingGlobal] = useState(false);
  const [actingDraftId, setActingDraftId] = useState<number | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  const fetchOverview = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/agents/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setOverview(await res.json());
      }
    } catch (e) {
      console.error('Failed to load agents overview:', e);
    }
  }, [token]);

  const fetchDrafts = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (agentFilter) params.set('agent_key', agentFilter);
      params.set('limit', '50');
      const res = await fetch(`${API_BASE_URL}/admin/agents/drafts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.items || []);
      }
    } catch (e) {
      console.error('Failed to load agent drafts:', e);
    }
  }, [token, statusFilter, agentFilter]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchOverview(), fetchDrafts()]);
    setLoading(false);
  }, [fetchOverview, fetchDrafts]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleGlobalMode = async (mode: 'preview' | 'autopilot') => {
    setSwitchingGlobal(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/agents/set-global-mode`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        toast.success(
          mode === 'autopilot'
            ? 'Autopilot enabled — agents will schedule and deliver automatically.'
            : 'Preview Mode enabled — agents will draft messages here without sending.'
        );
        await fetchOverview();
      } else {
        toast.error('Failed to update global mode');
      }
    } catch {
      toast.error('Network error updating agent mode');
    } finally {
      setSwitchingGlobal(false);
    }
  };

  const handleUpdateAgent = async (agentKey: string, patch: Record<string, any>) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/agents/${agentKey}/config`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        toast.success('Agent settings saved');
        await fetchOverview();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to update agent');
      }
    } catch {
      toast.error('Network error saving agent settings');
    }
  };

  const handleRunNow = async (agentKey?: string) => {
    setRunningAgent(agentKey || 'all');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/agents/run-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_key: agentKey || null }),
      });
      if (res.ok) {
        const data = await res.json();
        const agents = data.result?.agents || {};
        const draftedTotal = Object.values(agents).reduce(
          (sum: number, a: any) => sum + Number(a?.drafted || 0),
          0
        );
        toast.success(`Agents cycle finished: ${draftedTotal} new message(s) drafted.`);
        await refreshAll();
      } else {
        toast.error('Failed to execute agents');
      }
    } catch {
      toast.error('Network error executing agents');
    } finally {
      setRunningAgent(null);
    }
  };

  const handleApproveDraft = async (draftId: number) => {
    setActingDraftId(draftId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/agents/drafts/${draftId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(`Draft #${draftId} approved and dispatched.`);
        await refreshAll();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to approve draft');
      }
    } catch {
      toast.error('Network error approving draft');
    } finally {
      setActingDraftId(null);
    }
  };

  const handleRejectDraft = async (draftId: number) => {
    setActingDraftId(draftId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/agents/drafts/${draftId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(`Draft #${draftId} dismissed.`);
        await refreshAll();
      } else {
        toast.error('Failed to dismiss draft');
      }
    } catch {
      toast.error('Network error dismissing draft');
    } finally {
      setActingDraftId(null);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      const params = agentFilter ? `?agent_key=${encodeURIComponent(agentFilter)}` : '';
      const res = await fetch(`${API_BASE_URL}/admin/agents/drafts/approve-all${params}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Queued ${data.queued_count || 0} approved drafts for delivery.`);
        await refreshAll();
      } else {
        toast.error('Batch approval failed');
      }
    } catch {
      toast.error('Network error during batch approval');
    } finally {
      setApprovingAll(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#d3da0c] mb-3" />
        <p className="text-sm">Loading Autonomous Engagement Agents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Mission Control Header */}
      <div className="rounded-2xl bg-[#071205] border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center text-[#d3da0c] shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-white font-bold text-base">Autonomous Growth & Engagement Agents</h3>
                <span
                  className={`text-[0.625rem] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                    overview?.global_mode === 'autopilot'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                  }`}
                >
                  {overview?.global_mode === 'autopilot'
                    ? 'AUTOPILOT LIVE'
                    : overview?.global_mode === 'mixed'
                    ? 'MIXED MODE'
                    : 'PREVIEW / DRY-RUN'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Copy Engine: <span className="text-gray-200 font-medium">{overview?.copywriter.label}</span>
                {' · '}Zero repetitive &ldquo;We Miss You&rdquo; blasts — supply-aware, morning-scheduled, and click-learning.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {overview?.global_mode !== 'autopilot' ? (
              <button
                onClick={() => handleGlobalMode('autopilot')}
                disabled={switchingGlobal}
                className="px-3.5 py-2 rounded-xl bg-[#d3da0c] text-black text-xs font-extrabold hover:bg-[#c5cc0b] transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {switchingGlobal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                Switch to Autopilot
              </button>
            ) : (
              <button
                onClick={() => handleGlobalMode('preview')}
                disabled={switchingGlobal}
                className="px-3.5 py-2 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {switchingGlobal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                Switch to Preview Mode
              </button>
            )}

            <button
              onClick={() => handleRunNow()}
              disabled={runningAgent !== null}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {runningAgent === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run All Agents Now
            </button>

            <button
              onClick={refreshAll}
              aria-label="Refresh agents"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Supply Readiness Strip */}
        {overview && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-white/10">
            <div className="rounded-xl bg-black/40 border border-white/5 p-3">
              <p className="text-[0.6875rem] text-gray-400">Upcoming Approved Events</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-extrabold text-white">
                  {overview.inventory_health.upcoming_approved_events}
                </span>
                <span
                  className={`text-[0.625rem] font-bold px-2 py-0.5 rounded-full ${
                    overview.inventory_health.event_radar_silence_active
                      ? 'bg-gray-500/20 text-gray-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {overview.inventory_health.event_radar_silence_active ? 'Silence Rule Active' : 'Radar Armed'}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-black/40 border border-white/5 p-3">
              <p className="text-[0.6875rem] text-gray-400">Spotlight-Ready Talent & Stores</p>
              <p className="text-lg font-extrabold text-white mt-1">
                {overview.inventory_health.spotlight_ready_artists} Artists · {overview.inventory_health.spotlight_ready_vendors} Vendors
              </p>
            </div>

            <div className="rounded-xl bg-black/40 border border-white/5 p-3">
              <p className="text-[0.6875rem] text-gray-400">Incomplete Provider Profiles</p>
              <p className="text-lg font-extrabold text-[#d3da0c] mt-1">
                {overview.inventory_health.total_incomplete_providers}
                <span className="text-xs font-normal text-gray-400 ml-2">
                  ({overview.inventory_health.incomplete_providers.artist}A / {overview.inventory_health.incomplete_providers.business}B / {overview.inventory_health.incomplete_providers.vendor}V)
                </span>
              </p>
            </div>

            <div className="rounded-xl bg-black/40 border border-white/5 p-3">
              <p className="text-[0.6875rem] text-gray-400">Click-Learning & Fatigue Guard</p>
              <p className="text-lg font-extrabold text-white mt-1">
                {overview.telemetry.overall_ctr_pct}% CTR
                <span className="text-xs font-normal text-gray-400 ml-2">
                  ({overview.telemetry.auto_throttled_users} throttled)
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4 Autonomous Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(overview?.agents || []).map((agent) => {
          const Icon = AGENT_ICONS[agent.agent_key] || Bot;
          const isPassive = agent.agent_key === 'click_optimizer';
          return (
            <div
              key={agent.agent_key}
              className="rounded-2xl bg-[#0b120a] border border-white/10 p-4 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#d3da0c]/10 border border-[#d3da0c]/25 flex items-center justify-center text-[#d3da0c] shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm">{agent.name}</h4>
                      <span className="text-[0.6875rem] text-gray-400 font-mono">{agent.agent_key}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUpdateAgent(agent.agent_key, { is_enabled: !agent.is_enabled })}
                    className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-bold border transition-colors ${
                      agent.is_enabled
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-white/5 text-gray-400 border-white/10'
                    }`}
                  >
                    {agent.is_enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">{agent.description}</p>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-lg bg-black/40 px-2.5 py-2 border border-white/5">
                    <p className="text-[0.625rem] text-gray-500 uppercase">Preview Queue</p>
                    <p className="text-sm font-bold text-amber-300">{agent.metrics.preview_drafts}</p>
                  </div>
                  <div className="rounded-lg bg-black/40 px-2.5 py-2 border border-white/5">
                    <p className="text-[0.625rem] text-gray-500 uppercase">Sent</p>
                    <p className="text-sm font-bold text-white">{agent.metrics.sent}</p>
                  </div>
                  <div className="rounded-lg bg-black/40 px-2.5 py-2 border border-white/5">
                    <p className="text-[0.625rem] text-gray-500 uppercase">CTR</p>
                    <p className="text-sm font-bold text-[#d3da0c]">{agent.metrics.ctr_pct}%</p>
                  </div>
                </div>
              </div>

              {/* Per-Agent Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  {!isPassive && (
                    <>
                      <Clock className="w-3.5 h-3.5 text-[#d3da0c]" />
                      <select
                        value={agent.default_send_hour}
                        onChange={(e) =>
                          handleUpdateAgent(agent.agent_key, {
                            default_send_hour: Number(e.target.value),
                          })
                        }
                        aria-label={`${agent.name} default send hour`}
                        className="bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        {[8, 9, 10, 11, 12, 14, 17, 18, 19, 20].map((hr) => (
                          <option key={hr} value={hr}>
                            {hr.toString().padStart(2, '0')}:00 local
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() =>
                          handleUpdateAgent(agent.agent_key, {
                            mode: agent.mode === 'autopilot' ? 'preview' : 'autopilot',
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-bold border ${
                          agent.mode === 'autopilot'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {agent.mode === 'autopilot' ? 'Autopilot' : 'Preview'}
                      </button>
                    </>
                  )}
                  {isPassive && (
                    <span className="text-[0.6875rem] text-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Always-on click & fatigue optimizer
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleRunNow(agent.agent_key)}
                  disabled={runningAgent !== null}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {runningAgent === agent.agent_key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  Run
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Drafts & Sent Audit Feed */}
      <div className="rounded-2xl bg-[#0b120a] border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-white font-bold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#d3da0c]" />
              Agent Drafts & Delivery Log
            </h4>
            <p className="text-xs text-gray-400">
              Inspect every message drafted by your agents, see why it was chosen, and approve or dismiss before switching to Autopilot.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter drafts by status"
              className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value="draft">Preview Drafts</option>
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="clicked">Clicked</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              aria-label="Filter drafts by agent"
              className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value="">All Agents</option>
              <option value="event_radar">Event Radar</option>
              <option value="talent_spotlight">Talent Spotlight</option>
              <option value="provider_coach">Provider Coach</option>
            </select>

            {statusFilter === 'draft' && drafts.length > 0 && (
              <button
                onClick={handleApproveAll}
                disabled={approvingAll}
                className="px-3 py-1.5 rounded-xl bg-[#d3da0c] text-black text-xs font-extrabold hover:bg-[#c4cb0b] flex items-center gap-1.5 disabled:opacity-50"
              >
                {approvingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                Approve & Queue All ({drafts.length})
              </button>
            )}
          </div>
        </div>

        {drafts.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-xs border border-dashed border-white/10 rounded-xl">
            <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
            No messages in this view yet. Click <strong className="text-white">Run All Agents Now</strong> above to preview what your agents draft from live platform data.
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="rounded-xl bg-black/40 border border-white/10 p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[0.625rem] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        STATUS_BADGE[d.status] || 'bg-white/10 text-gray-300 border-white/15'
                      }`}
                    >
                      {d.status}
                    </span>
                    <span className="text-[0.6875rem] font-mono text-[#d3da0c]">{d.agent_key}</span>
                    <span className="text-[0.6875rem] text-gray-400">
                      To: <strong className="text-gray-200">{d.recipient_name}</strong> ({d.recipient_role || 'user'} · {d.city || 'China'})
                    </span>
                    {d.local_send_hour !== null && (
                      <span className="text-[0.6875rem] text-gray-500">
                        {String(d.local_send_hour).padStart(2, '0')}:00 local
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-bold text-white">{d.title}</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{d.message}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[0.6875rem] text-gray-400">
                    {d.reasoning && (
                      <span>
                        <strong className="text-gray-300">Why:</strong> {d.reasoning}
                      </span>
                    )}
                    {d.action_url && (
                      <span className="font-mono text-[#d3da0c]/80">Link: {d.action_url}</span>
                    )}
                  </div>
                </div>

                {d.status === 'draft' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApproveDraft(d.id)}
                      disabled={actingDraftId === d.id}
                      className="px-3 py-2 rounded-xl bg-[#d3da0c] text-black text-xs font-extrabold hover:bg-[#c5cc0b] flex items-center gap-1 disabled:opacity-50"
                    >
                      {actingDraftId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve & Send
                    </button>
                    <button
                      onClick={() => handleRejectDraft(d.id)}
                      disabled={actingDraftId === d.id}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/15 text-gray-300 hover:text-red-400 border border-white/10 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutonomousAgentsPanel;
