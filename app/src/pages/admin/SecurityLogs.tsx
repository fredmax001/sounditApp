import { useState, useEffect, useCallback } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Search, AlertTriangle, Loader2,
  User, Lock, Unlock, Trash2, LogIn, LogOut, Edit,
  Activity, FileX, RefreshCw, Shield
} from 'lucide-react';

interface SecurityLog {
  id: string | number;
  user_email?: string | null;
  action?: string | null;
  ip_address?: string | null;
  event_type?: string | null;
  severity?: string | null;
  endpoint?: string | null;
  method?: string | null;
  details?: string | Record<string, unknown> | null;
  created_at?: string | null;
}

interface Stats {
  total_logs_7d?: number;
  failed_logins_7d?: number;
  suspicious_activities_7d?: number;
}

const formatLogDetails = (details: SecurityLog['details']): string => {
  if (!details) return '-';
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) return '-';
    return entries
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ');
  }
  return String(details);
};

const formatEventLabel = (eventType?: string | null): string => {
  if (!eventType) return 'Activity';
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const SecurityLogs = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateRange, setDateRange] = useState('7');

  const loadLogs = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ days: dateRange });
      if (actionFilter) params.set('event_type', actionFilter);
      const headers = { Authorization: `Bearer ${session?.access_token}` };

      const [logsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/security/logs?${params.toString()}`, { headers }),
        fetch(`${API_BASE_URL}/admin/security/stats`, { headers }),
      ]);

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(Array.isArray(data) ? data : Array.isArray(data?.logs) ? data.logs : []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData || {});
      }
    } catch {
      toast.error(t('admin.securityLogs.failedToLoadSecurityLogs') || 'Failed to load security logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token, dateRange, actionFilter, t]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getActionIcon = (eventType?: string | null) => {
    const key = (eventType || '').toLowerCase();
    if (key.includes('admin_login')) return <Shield className="w-3.5 h-3.5" />;
    if (key.includes('login')) return <LogIn className="w-3.5 h-3.5" />;
    if (key.includes('logout')) return <LogOut className="w-3.5 h-3.5" />;
    if (key.includes('create') || key.includes('update')) return <Edit className="w-3.5 h-3.5" />;
    if (key.includes('delete')) return <Trash2 className="w-3.5 h-3.5" />;
    if (key.includes('freeze') || key.includes('suspend')) return <Lock className="w-3.5 h-3.5" />;
    if (key.includes('unfreeze') || key.includes('activate')) return <Unlock className="w-3.5 h-3.5" />;
    return <Activity className="w-3.5 h-3.5" />;
  };

  const getActionColor = (eventType?: string | null, severity?: string | null) => {
    const sev = (severity || '').toLowerCase();
    if (sev === 'high' || sev === 'critical' || sev === 'warning') {
      return 'text-amber-400 bg-amber-500/12 border-amber-500/20';
    }
    const key = (eventType || '').toLowerCase();
    if (key.includes('fail') || key.includes('delete') || key.includes('denied')) {
      return 'text-red-400 bg-red-500/12 border-red-500/20';
    }
    if (key.includes('admin_login')) return 'text-[#d3da0c] bg-[#d3da0c]/12 border-[#d3da0c]/25';
    if (key.includes('login')) return 'text-emerald-400 bg-emerald-500/12 border-emerald-500/20';
    if (key.includes('create')) return 'text-blue-400 bg-blue-500/12 border-blue-500/20';
    if (key.includes('update')) return 'text-amber-400 bg-amber-500/12 border-amber-500/20';
    return 'text-gray-300 bg-white/[0.06] border-white/[0.08]';
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const detailsText = formatLogDetails(log.details).toLowerCase();
    return (
      (log.user_email || '').toLowerCase().includes(q) ||
      (log.event_type || '').toLowerCase().includes(q) ||
      (log.ip_address || '').toLowerCase().includes(q) ||
      (log.endpoint || '').toLowerCase().includes(q) ||
      detailsText.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="System & Access"
        title={t('admin.securityLogs.title') || 'Security Logs'}
        subtitle={t('admin.securityLogs.subtitle') || 'Audit trail of authentication, admin console access, and security events'}
        actions={
          <button
            onClick={loadLogs}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#d3da0c] text-black rounded-lg hover:bg-[#c0c70b] disabled:opacity-60 transition-colors text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Events (7d)</span>
            <Activity className="w-4 h-4 text-[#d3da0c]" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">{stats.total_logs_7d || 0}</p>
        </div>
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Failed Logins (7d)</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">{stats.failed_logins_7d || 0}</p>
        </div>
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Suspicious Activity (7d)</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">{stats.suspicious_activities_7d || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by email, IP, event, or endpoint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0D130D] border border-black/10 dark:border-white/[0.08] rounded-xl text-[#020b00] dark:text-white placeholder-gray-500 focus:border-[#d3da0c]/60 focus:outline-none text-sm"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2.5">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-white dark:bg-[#0D130D] border border-black/10 dark:border-white/[0.08] rounded-xl text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]/60"
          >
            <option value="">All Events</option>
            <option value="admin_login">Admin Login</option>
            <option value="login">User Login</option>
            <option value="logout">Logout</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3.5 py-2.5 bg-white dark:bg-[#0D130D] border border-black/10 dark:border-white/[0.08] rounded-xl text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]/60"
          >
            <option value="1">Last 24 Hours</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 px-4 text-center">
            <FileX className="w-10 h-10 mb-3 text-gray-600" />
            <p className="text-sm text-[#020b00] dark:text-white">No security logs found</p>
            <p className="text-xs text-gray-500 mt-1">Logs will appear here once security events are recorded.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-white/[0.06]">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs ${getActionColor(log.event_type, log.severity)}`}>
                      {getActionIcon(log.event_type)}
                      <span>{formatEventLabel(log.event_type)}</span>
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{log.ip_address || '-'}</span>
                  </div>
                  <p className="text-sm text-[#020b00] dark:text-white truncate">{log.user_email || 'System'}</p>
                  <p className="text-xs text-gray-400 break-words">{formatLogDetails(log.details)}</p>
                  <p className="text-[0.6875rem] text-gray-500 tabular-nums">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-black/[0.02] dark:bg-white/[0.03] border-b border-black/8 dark:border-white/[0.08]">
                  <tr>
                    <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Event</th>
                    <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Account</th>
                    <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">IP Address</th>
                    <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Details</th>
                    <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6 dark:divide-white/[0.06]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs ${getActionColor(log.event_type, log.severity)}`}>
                          {getActionIcon(log.event_type)}
                          <span>{formatEventLabel(log.event_type)}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-white/[0.06] rounded-lg flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-[#020b00] dark:text-white truncate">{log.user_email || 'System'}</p>
                            {log.endpoint && (
                              <p className="text-[0.6875rem] text-gray-500 font-mono truncate">
                                {log.method ? `${log.method} ` : ''}{log.endpoint}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 font-mono text-xs whitespace-nowrap">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs max-w-sm truncate" title={formatLogDetails(log.details)}>
                        {formatLogDetails(log.details)}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs text-right whitespace-nowrap tabular-nums">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SecurityLogs;
