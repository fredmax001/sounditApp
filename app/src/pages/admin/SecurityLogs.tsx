import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Search, AlertTriangle, Loader2,
  User, Lock, Unlock, Trash2, LogIn, LogOut, Edit,
  Download, Activity
} from 'lucide-react';

interface SecurityLog {
  id: string | number;
  user_name?: string;
  action?: string;
  ip_address?: string;
  event_type?: string;
  details?: string;
  created_at?: string;
}

interface Stats {
  total_events?: number;
  logins_today?: number;
  failed_attempts?: number;
  security_actions?: number;
}

const SecurityLogs = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateRange, setDateRange] = useState('7');

  useEffect(() => {
    loadLogs();
  }, [dateRange, actionFilter]);

  const loadLogs = async () => {
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/security/logs?days=${dateRange}&event_type=${actionFilter}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/security/stats`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
      ]);

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || data || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch {
      toast.error(t('admin.securityLogs.failedToLoadSecurityLogs'));
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login': return <LogIn className="w-4 h-4" />;
      case 'logout': return <LogOut className="w-4 h-4" />;
      case 'create': return <Edit className="w-4 h-4" />;
      case 'update': return <Edit className="w-4 h-4" />;
      case 'delete': return <Trash2 className="w-4 h-4" />;
      case 'freeze': return <Lock className="w-4 h-4" />;
      case 'unfreeze': return <Unlock className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login': return 'text-green-400 bg-green-500/10';
      case 'logout': return 'text-gray-400 bg-gray-500/10';
      case 'create': return 'text-blue-400 bg-blue-500/10';
      case 'update': return 'text-yellow-400 bg-yellow-500/10';
      case 'delete': return 'text-red-400 bg-red-500/10';
      case 'freeze': return 'text-orange-400 bg-orange-500/10';
      case 'unfreeze': return 'text-purple-400 bg-purple-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery || 
      log.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ip_address?.includes(searchQuery);
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.securityLogs.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.securityLogs.subtitle')}</p>
        </div>
        <button
          onClick={() => toast.info(t('admin.securityLogs.exportNotImplemented'))}
          className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {t('admin.securityLogs.exportLogs')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Activity className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.securityLogs.totalEvents')}</p>
              <p className="text-white font-bold text-xl">{stats.total_events || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <LogIn className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.securityLogs.loginsToday')}</p>
              <p className="text-white font-bold text-xl">{stats.logins_today || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.securityLogs.failedAttempts')}</p>
              <p className="text-white font-bold text-xl">{stats.failed_attempts || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Lock className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.securityLogs.securityActions')}</p>
              <p className="text-white font-bold text-xl">{stats.security_actions || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.securityLogs.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="">{t('admin.securityLogs.allActions')}</option>
          <option value="login">{t('admin.securityLogs.action.login')}</option>
          <option value="logout">{t('admin.securityLogs.action.logout')}</option>
          <option value="create">{t('admin.securityLogs.action.create')}</option>
          <option value="update">{t('admin.securityLogs.action.update')}</option>
          <option value="delete">{t('admin.securityLogs.action.delete')}</option>
          <option value="freeze">{t('admin.securityLogs.action.freeze')}</option>
          <option value="unfreeze">{t('admin.securityLogs.action.unfreeze')}</option>
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="1">{t('admin.securityLogs.last24Hours')}</option>
          <option value="7">{t('admin.securityLogs.last7Days')}</option>
          <option value="30">{t('admin.securityLogs.last30Days')}</option>
          <option value="90">{t('admin.securityLogs.last90Days')}</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.securityLogs.actionHeader')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.securityLogs.userHeader')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.securityLogs.ipAddressHeader')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.securityLogs.detailsHeader')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.securityLogs.timestampHeader')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium ${getActionColor(log.event_type)}`}>
                      {getActionIcon(log.event_type)}
                      <span className="capitalize">{t(`admin.securityLogs.action.${log.event_type}`)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-white">{log.user_name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-400 font-mono text-sm">{log.ip_address}</td>
                  <td className="p-4 text-gray-400 text-sm max-w-xs truncate">{log.details}</td>
                  <td className="p-4 text-gray-400 text-sm">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SecurityLogs;
