import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import {
  Eye, Users, Fingerprint, ArrowLeft, Globe,
  Calendar, Clock, Loader2, Monitor, MousePointer
} from 'lucide-react';
import { toast } from 'sonner';

interface VisitSummary {
  period_days: number;
  total_visits: number;
  unique_visitors: number;
  unique_sessions: number;
  top_pages: { path: string; count: number }[];
  daily: { date: string; visits: number; unique_ips: number }[];
}

interface RecentVisit {
  id: number;
  path: string;
  method: string;
  ip_address: string;
  user_agent: string;
  referrer: string | null;
  user_id: number | null;
  session_id: string | null;
  created_at: string;
}

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const token = session?.access_token;

  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchAnalytics = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [summaryRes, recentRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analytics/visits/summary?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/analytics/visits/recent?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      } else {
        toast.error('Failed to load analytics summary');
      }

      if (recentRes.ok) {
        setRecentVisits(await recentRes.json());
      }
    } catch {
      toast.error('Network error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [token, days]);

  const maxDailyVisits = useMemo(() => {
    if (!summary?.daily.length) return 1;
    return Math.max(...summary.daily.map((d) => d.visits));
  }, [summary]);

  const statCards = [
    {
      label: t('admin.analytics.totalVisits') || 'Total Visits',
      value: summary?.total_visits ?? 0,
      icon: Eye,
      color: 'text-[#d3da0c]',
      bg: 'bg-[#d3da0c]/10',
    },
    {
      label: t('admin.analytics.uniqueVisitors') || 'Unique Visitors',
      value: summary?.unique_visitors ?? 0,
      icon: Users,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
    },
    {
      label: t('admin.analytics.uniqueSessions') || 'Unique Sessions',
      value: summary?.unique_sessions ?? 0,
      icon: Fingerprint,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      label: t('admin.analytics.avgPerDay') || 'Avg Visits / Day',
      value: summary ? Math.round(summary.total_visits / summary.period_days) : 0,
      icon: Calendar,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-display text-white">
                {t('admin.analytics.title') || 'Analytics & Visits'}
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                {t('admin.analytics.subtitle') || 'Track page visits, unique visitors, and traffic patterns.'}
              </p>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-2">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  days === d
                    ? 'bg-[#d3da0c] text-black'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="bg-[#111111] rounded-xl p-5 border border-white/5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <span className="text-gray-400 text-sm">{card.label}</span>
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {card.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Daily Visits Chart */}
            {summary && summary.daily.length > 0 && (
              <div className="bg-[#111111] rounded-xl border border-white/5 p-6">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-[#d3da0c]" />
                  {t('admin.analytics.dailyVisits') || 'Daily Visits'}
                </h3>
                <div className="flex items-end gap-1 h-48 overflow-x-auto pb-2">
                  {summary.daily.map((day) => {
                    const heightPct = Math.max(
                      4,
                      (day.visits / maxDailyVisits) * 100
                    );
                    return (
                      <div
                        key={day.date}
                        className="flex-1 min-w-[32px] flex flex-col items-center gap-1"
                      >
                        <div className="text-xs text-gray-400 mb-1">
                          {day.visits}
                        </div>
                        <div
                          className="w-full bg-[#d3da0c]/60 rounded-t hover:bg-[#d3da0c] transition-colors relative group"
                          style={{ height: `${heightPct}%` }}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {day.date}: {day.visits} visits, {day.unique_ips} unique
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-500 truncate w-full text-center">
                          {new Date(day.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Pages */}
              <div className="bg-[#111111] rounded-xl border border-white/5 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#d3da0c]" />
                  {t('admin.analytics.topPages') || 'Top Pages'}
                </h3>
                {summary && summary.top_pages.length > 0 ? (
                  <div className="space-y-3">
                    {summary.top_pages.map((page, idx) => (
                      <div
                        key={page.path}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-gray-500 text-sm w-6">
                            #{idx + 1}
                          </span>
                          <MousePointer className="w-4 h-4 text-gray-500 shrink-0" />
                          <span className="text-white text-sm truncate">
                            {page.path}
                          </span>
                        </div>
                        <span className="text-[#d3da0c] font-semibold text-sm shrink-0">
                          {page.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Globe className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>{t('admin.analytics.noPageData') || 'No page data available'}</p>
                  </div>
                )}
              </div>

              {/* Recent Visits */}
              <div className="bg-[#111111] rounded-xl border border-white/5 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#d3da0c]" />
                  {t('admin.analytics.recentVisits') || 'Recent Visits'}
                </h3>
                {recentVisits.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {recentVisits.slice(0, 20).map((visit) => (
                      <div
                        key={visit.id}
                        className="flex items-start gap-3 p-3 bg-white/5 rounded-lg"
                      >
                        <div className="w-8 h-8 bg-[#d3da0c]/10 rounded-full flex items-center justify-center shrink-0">
                          <Eye className="w-4 h-4 text-[#d3da0c]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">
                            {visit.path}
                          </p>
                          <div className="flex items-center gap-2 text-gray-500 text-xs mt-1">
                            <span>{visit.ip_address}</span>
                            {visit.user_id && (
                              <span className="text-blue-400">
                                User #{visit.user_id}
                              </span>
                            )}
                            <span>
                              {new Date(visit.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>{t('admin.analytics.noRecentVisits') || 'No recent visits'}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
