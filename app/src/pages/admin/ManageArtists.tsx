import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Music, Search, Check, Trash2, Loader2, Users, Calendar, Sparkles, XCircle, Lock, Unlock
} from 'lucide-react';

interface Artist {
  id: number;
  stage_name?: string;
  genre?: string;
  is_verified?: boolean;
  verification_badge?: boolean;
  is_featured?: boolean;
  followers_count?: number;
  events_count?: number;
  user_name?: string;
  user_id?: number;
  status?: string;
}

const ManageArtists = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/artists`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setArtists(data || []);
      }
    } catch {
      toast.error(t('admin.manageArtists.failedToLoadArtists'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: number) => {
    setActionLoading(`verify-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/artists/${id}/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageArtists.artistVerified'));
        loadArtists();
      }
    } catch {
      toast.error(t('admin.manageArtists.failedToVerifyArtist'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnverify = async (id: number) => {
    setActionLoading(`unverify-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/artists/${id}/unverify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Artist unverified');
        loadArtists();
      }
    } catch {
      toast.error('Failed to unverify artist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFeature = async (id: number) => {
    setActionLoading(`feature-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/artists/${id}/feature`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.is_featured ? t('admin.manageArtists.artistFeatured') : t('admin.manageArtists.artistUnfeatured'));;
        loadArtists();
      }
    } catch {
      toast.error(t('admin.manageArtists.failedToUpdateFeaturedStatus'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('admin.manageArtists.confirmDelete'))) return;
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/artists/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageArtists.artistDeleted'));
        loadArtists();
      }
    } catch {
      toast.error(t('admin.manageArtists.failedToDeleteArtist'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (userId: number) => {
    setActionLoading(`activate-${userId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/activate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Account activated');
        loadArtists();
      }
    } catch {
      toast.error('Failed to activate account');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (userId: number) => {
    setActionLoading(`suspend-${userId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Account suspended');
        loadArtists();
      }
    } catch {
      toast.error('Failed to suspend account');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredArtists = artists.filter(artist => {
    const matchesSearch = !searchQuery || 
      artist.stage_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artist.genre?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = !genreFilter || artist.genre === genreFilter;
    return matchesSearch && matchesGenre;
  });

  const genres = [...new Set(artists.map(a => a.genre).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.manageArtists.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.manageArtists.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Music className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageArtists.totalArtists')}</p>
              <p className="text-white font-bold text-xl">{artists.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageArtists.verified')}</p>
              <p className="text-white font-bold text-xl">
                {artists.filter(a => a.is_verified).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageArtists.totalFollowers')}</p>
              <p className="text-white font-bold text-xl">
                {artists.reduce((acc, a) => acc + (a.followers_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageArtists.totalEvents')}</p>
              <p className="text-white font-bold text-xl">
                {artists.reduce((acc, a) => acc + (a.events_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageArtists.featured')}</p>
              <p className="text-white font-bold text-xl">
                {artists.filter(a => a.is_featured).length}
              </p>
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
            placeholder={t('admin.manageArtists.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
        <select
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="">{t('admin.manageArtists.allGenres')}</option>
          {genres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Artists Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageArtists.artist')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageArtists.genre')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageArtists.followers')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageArtists.events')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageArtists.status')}</th>
                <th className="text-right text-gray-400 text-sm font-medium p-4">{t('admin.manageArtists.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredArtists.map((artist) => (
                <tr key={artist.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                        {artist.stage_name?.[0] || 'A'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{artist.stage_name}</p>
                        <p className="text-gray-500 text-sm">{artist.user_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-400">{artist.genre || t('admin.manageArtists.na')}</td>
                  <td className="p-4 text-gray-400">{artist.followers_count || 0}</td>
                  <td className="p-4 text-gray-400">{artist.events_count || 0}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${
                        artist.is_verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {artist.is_verified ? t('admin.manageArtists.verifiedStatus') : t('admin.manageArtists.pendingStatus')}
                      </span>
                      {artist.is_featured && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium w-fit bg-yellow-500/20 text-yellow-400">
                          {t('admin.manageArtists.featuredBadge')}
                        </span>
                      )}
                      {artist.status === 'suspended' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium w-fit bg-red-500/20 text-red-400">
                          Suspended
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {!artist.is_verified ? (
                        <button
                          onClick={() => handleVerify(artist.id)}
                          disabled={actionLoading === `verify-${artist.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg text-green-400"
                          title={t('admin.manageArtists.verify')}
                        >
                          {actionLoading === `verify-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverify(artist.id)}
                          disabled={actionLoading === `unverify-${artist.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg text-orange-400"
                          title="Unverify"
                        >
                          {actionLoading === `unverify-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleFeature(artist.id)}
                        disabled={actionLoading === `feature-${artist.id}`}
                        className={`p-2 hover:bg-white/10 rounded-lg ${artist.is_featured ? 'text-yellow-400' : 'text-gray-400'}`}
                        title={artist.is_featured ? t('admin.manageArtists.unfeature') : t('admin.manageArtists.feature')}
                      >
                        {actionLoading === `feature-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                      {artist.status === 'suspended' ? (
                        <button
                          onClick={() => artist.user_id && handleActivate(artist.user_id)}
                          disabled={actionLoading === `activate-${artist.user_id}` || !artist.user_id}
                          className="p-2 hover:bg-white/10 rounded-lg text-green-400"
                          title="Activate account"
                        >
                          {actionLoading === `activate-${artist.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => artist.user_id && handleSuspend(artist.user_id)}
                          disabled={actionLoading === `suspend-${artist.user_id}` || !artist.user_id}
                          className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                          title="Suspend account"
                        >
                          {actionLoading === `suspend-${artist.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(artist.id)}
                        disabled={actionLoading === `delete-${artist.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                        title="Delete"
                      >
                        {actionLoading === `delete-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
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

export default ManageArtists;
