import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Shield, Search, Check, AlertTriangle, Flag, Eye,
  Loader2, User, Calendar, AlertOctagon
} from 'lucide-react';

interface Report {
  id: number;
  type: string;
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'resolved' | 'dismissed';
  reason: string;
  reporter_name: string;
  created_at: string;
}

interface Stats {
  pending?: number;
  total?: number;
  resolved_today?: number;
  auto_moderated?: number;
}

const ReportsModeration = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const [reportsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/reports`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/reports/stats`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
      ]);

      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setReports(data || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch {
      toast.error(t('admin.reportsModeration.failedToLoadReports'));
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: number, action: string) => {
    setActionLoading(`resolve-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/${id}/resolve`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        toast.success(t('admin.reportsModeration.reportResolved'));
        loadReports();
      }
    } catch {
      toast.error(t('admin.reportsModeration.failedToResolveReport'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (id: number) => {
    setActionLoading(`dismiss-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.reportsModeration.reportDismissed'));
        loadReports();
      }
    } catch {
      toast.error(t('admin.reportsModeration.failedToDismissReport'));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = !searchQuery || 
      report.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.reporter_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || report.status === statusFilter;
    const matchesType = !typeFilter || report.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.reportsModeration.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.reportsModeration.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.reportsModeration.pendingReports')}</p>
              <p className="text-white font-bold text-xl">{stats.pending || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Flag className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.reportsModeration.totalReports')}</p>
              <p className="text-white font-bold text-xl">{stats.total || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.reportsModeration.resolvedToday')}</p>
              <p className="text-white font-bold text-xl">{stats.resolved_today || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.reportsModeration.autoModerated')}</p>
              <p className="text-white font-bold text-xl">{stats.auto_moderated || 0}</p>
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
            placeholder={t('admin.reportsModeration.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="">{t('admin.reportsModeration.allTypes')}</option>
          <option value="event">{t('admin.reportsModeration.typeEvent')}</option>
          <option value="user">{t('admin.reportsModeration.typeUser')}</option>
          <option value="comment">{t('admin.reportsModeration.typeComment')}</option>
          <option value="message">{t('admin.reportsModeration.typeMessage')}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="">{t('admin.reportsModeration.allStatus')}</option>
          <option value="pending">{t('admin.reportsModeration.statusPending')}</option>
          <option value="resolved">{t('admin.reportsModeration.statusResolved')}</option>
          <option value="dismissed">{t('admin.reportsModeration.statusDismissed')}</option>
        </select>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <AnimatePresence>
            {filteredReports.map((report) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#111111] border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      report.severity === 'high' ? 'bg-red-500/20' :
                      report.severity === 'medium' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
                    }`}>
                      <AlertOctagon className={`w-6 h-6 ${
                        report.severity === 'high' ? 'text-red-400' :
                        report.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold capitalize">{t('admin.reportsModeration.reportOfType', { type: report.type })}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          report.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                          report.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {t(`admin.reportsModeration.severity.${report.severity}`)}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">{report.reason}</p>
                      <div className="flex items-center gap-4 text-gray-500 text-xs mt-2">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {t('admin.reportsModeration.reportedBy', { name: report.reporter_name })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.status === 'pending' && (
                      <>
                        <button
                          className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10"
                          title={t('admin.reportsModeration.viewDetailsTitle')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleResolve(report.id, 'remove')}
                          disabled={actionLoading === `resolve-${report.id}`}
                          className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 text-sm font-medium"
                        >
                          {actionLoading === `resolve-${report.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.reportsModeration.removeButton')}
                        </button>
                        <button
                          onClick={() => handleDismiss(report.id)}
                          disabled={actionLoading === `dismiss-${report.id}`}
                          className="px-3 py-2 bg-gray-500/10 text-gray-400 rounded-lg hover:bg-gray-500/20 text-sm font-medium"
                        >
                          {actionLoading === `dismiss-${report.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.reportsModeration.dismissButton')}
                        </button>
                      </>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {t(`admin.reportsModeration.status.${report.status}`)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ReportsModeration;
