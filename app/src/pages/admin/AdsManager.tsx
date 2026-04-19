import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Megaphone, Search, Plus, Edit2, Trash2, Eye, EyeOff, Loader2, Save, X,
  BarChart3, Target
} from 'lucide-react';

interface Ad {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  link_url?: string;
  position: 'homepage' | 'sidebar' | 'events' | 'banner';
  status: 'active' | 'paused' | 'ended';
  start_date?: string;
  end_date?: string;
  impressions: number;
  clicks: number;
  budget?: number;
  created_at: string;
}

const AdsManager = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingAd, setEditingAd] = useState<Partial<Ad> | null>(null);

  const loadAds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ads`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAds(data.ads || data || []);
      }
    } catch {
      toast.error(t('admin.adsManager.failedToLoadAds'));
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd?.title) {
      toast.error(t('admin.adsManager.titleIsRequired'));
      return;
    }

    setActionLoading('save');
    try {
      const method = editingAd.id ? 'PUT' : 'POST';
      const url = editingAd.id 
        ? `${API_BASE_URL}/admin/ads/${editingAd.id}`
        : `${API_BASE_URL}/admin/ads`;

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingAd)
      });

      if (res.ok) {
        toast.success(editingAd.id ? t('admin.adsManager.adUpdated') : t('admin.adsManager.adCreated'));;
        setShowEditor(false);
        setEditingAd(null);
        loadAds();
      } else {
        toast.error(t('admin.adsManager.failedToSaveAd'));
      }
    } catch {
      toast.error(t('admin.adsManager.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAd = async (id: number) => {
    if (!confirm(t('admin.adsManager.confirmDeleteAd'))) return;

    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ads/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (res.ok) {
        toast.success(t('admin.adsManager.adDeleted'));
        loadAds();
      } else {
        toast.error(t('admin.adsManager.failedToDeleteAd'));
      }
    } catch {
      toast.error(t('admin.adsManager.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (ad: Ad) => {
    const newStatus = ad.status === 'active' ? 'paused' : 'active';
    setActionLoading(`status-${ad.id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ads/${ad.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        toast.success(newStatus === 'active' ? t('admin.adsManager.adActivated') : t('admin.adsManager.adPaused'));
        loadAds();
      } else {
        toast.error(t('admin.adsManager.failedToUpdateStatus'));
      }
    } catch {
      toast.error(t('admin.adsManager.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAds = ads.filter(ad => {
    const matchesSearch = !searchQuery || 
      ad.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ad.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition = !positionFilter || ad.position === positionFilter;
    const matchesStatus = !statusFilter || ad.status === statusFilter;
    return matchesSearch && matchesPosition && matchesStatus;
  });

  const totalImpressions = ads.reduce((acc, ad) => acc + (ad.impressions || 0), 0);
  const totalClicks = ads.reduce((acc, ad) => acc + (ad.clicks || 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400';
      case 'ended': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.adsManager.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.adsManager.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setEditingAd({ 
              title: '', 
              description: '', 
              position: 'homepage', 
              status: 'paused',
              link_url: '',
              image_url: ''
            });
            setShowEditor(true);
          }}
          className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('admin.adsManager.newAd')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Megaphone className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.adsManager.totalAds')}</p>
              <p className="text-white font-bold text-xl">{ads.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.adsManager.totalImpressions')}</p>
              <p className="text-white font-bold text-xl">{totalImpressions.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Target className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.adsManager.totalClicks')}</p>
              <p className="text-white font-bold text-xl">{totalClicks.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.adsManager.ctr')}</p>
              <p className="text-white font-bold text-xl">{ctr}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.adsManager.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="">{t('admin.adsManager.allPositions')}</option>
          <option value="homepage">{t('admin.adsManager.positionHomepage')}</option>
          <option value="sidebar">{t('admin.adsManager.positionSidebar')}</option>
          <option value="events">{t('admin.adsManager.positionEvents')}</option>
          <option value="banner">{t('admin.adsManager.positionBanner')}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="">{t('admin.adsManager.allStatus')}</option>
          <option value="active">{t('admin.adsManager.statusActive')}</option>
          <option value="paused">{t('admin.adsManager.statusPaused')}</option>
          <option value="ended">{t('admin.adsManager.statusEnded')}</option>
        </select>
      </div>

      {/* Ads Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.adsManager.ad')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.adsManager.position')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.adsManager.status')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.adsManager.performance')}</th>
                <th className="text-right text-gray-400 text-sm font-medium p-4">{t('admin.adsManager.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAds.map((ad) => (
                <tr key={ad.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#d3da0c] to-[#bbc10b] rounded-lg flex items-center justify-center">
                        {ad.image_url ? (
                          <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Megaphone className="w-6 h-6 text-black" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{ad.title}</p>
                        <p className="text-gray-500 text-sm truncate max-w-xs">{ad.description || t('admin.adsManager.noDescription')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-white/10 rounded text-gray-400 text-sm capitalize">
                      {ad.position}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ad.status)}`}>
                      {ad.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <p className="text-gray-400">{ad.impressions?.toLocaleString() || 0} {t('admin.adsManager.impressions')}</p>
                      <p className="text-gray-400">{ad.clicks?.toLocaleString() || 0} {t('admin.adsManager.clicks')}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleStatus(ad)}
                        disabled={actionLoading === `status-${ad.id}`}
                        className={`p-2 hover:bg-white/10 rounded-lg ${ad.status === 'active' ? 'text-yellow-400' : 'text-green-400'}`}
                        title={ad.status === 'active' ? t('admin.adsManager.pause') : t('admin.adsManager.activate')}
                      >
                        {actionLoading === `status-${ad.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                          ad.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingAd(ad);
                          setShowEditor(true);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg text-blue-400"
                        title={t('admin.adsManager.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAd(ad.id)}
                        disabled={actionLoading === `delete-${ad.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                        title={t('admin.adsManager.delete')}
                      >
                        {actionLoading === `delete-${ad.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAds.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t('admin.adsManager.noAdsFound')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Ad Editor Modal */}
      {showEditor && editingAd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingAd.id ? t('admin.adsManager.editAd') : t('admin.adsManager.newAd')}
              </h2>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingAd(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSaveAd} className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.adsManager.titleLabel')} *</label>
                <input
                  type="text"
                  value={editingAd.title || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, title: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.adsManager.description')}</label>
                <textarea
                  value={editingAd.description || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('admin.adsManager.position')}</label>
                  <select
                    value={editingAd.position || 'homepage'}
                    onChange={(e) => setEditingAd({ ...editingAd, position: e.target.value as Ad['position'] })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  >
                    <option value="homepage">{t('admin.adsManager.positionHomepage')}</option>
                    <option value="sidebar">{t('admin.adsManager.positionSidebar')}</option>
                    <option value="events">{t('admin.adsManager.positionEvents')}</option>
                    <option value="banner">{t('admin.adsManager.positionBanner')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('admin.adsManager.status')}</label>
                  <select
                    value={editingAd.status || 'paused'}
                    onChange={(e) => setEditingAd({ ...editingAd, status: e.target.value as Ad['status'] })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  >
                    <option value="active">{t('admin.adsManager.statusActive')}</option>
                    <option value="paused">{t('admin.adsManager.statusPaused')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.adsManager.imageUrl')}</label>
                <input
                  type="url"
                  value={editingAd.image_url || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, image_url: e.target.value })}
                  placeholder={t('admin.adsManager.urlPlaceholder')}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.adsManager.linkUrl')}</label>
                <input
                  type="url"
                  value={editingAd.link_url || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, link_url: e.target.value })}
                  placeholder={t('admin.adsManager.urlPlaceholder')}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('admin.adsManager.startDate')}</label>
                  <input
                    type="date"
                    value={editingAd.start_date?.split('T')[0] || ''}
                    onChange={(e) => setEditingAd({ ...editingAd, start_date: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('admin.adsManager.endDate')}</label>
                  <input
                    type="date"
                    value={editingAd.end_date?.split('T')[0] || ''}
                    onChange={(e) => setEditingAd({ ...editingAd, end_date: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditor(false);
                    setEditingAd(null);
                  }}
                  className="px-4 py-2 border border-white/10 text-white rounded-lg hover:bg-white/5"
                >
                  {t('admin.adsManager.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'save'}
                  className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('admin.adsManager.saveAd')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsManager;
