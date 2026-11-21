import { useState, useEffect } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Music, Search, Check, Trash2, Loader2, Users, Calendar, XCircle, Lock, Unlock, Eye, MapPin
} from 'lucide-react';
import EntityDetailModal from '@/components/admin/EntityDetailModal';

interface Artist {
  id: number;
  stage_name?: string;
  genre?: string;
  city?: string;
  is_verified?: boolean;
  is_approved?: boolean;
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
  const [cityFilter, setCityFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleViewArtistCard = (artistId: string | number) => {
    setSelectedArtistId(artistId);
    setIsDetailModalOpen(true);
  };

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
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || t('admin.manageArtists.failedToVerifyArtist'));
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
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || 'Failed to unverify artist');
      }
    } catch {
      toast.error('Failed to unverify artist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id: number) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/artists/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Artist approved');
        loadArtists();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || 'Failed to approve artist');
      }
    } catch {
      toast.error('Failed to approve artist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnapprove = async (id: number) => {
    setActionLoading(`unapprove-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/artists/${id}/unapprove`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Artist unapproved');
        loadArtists();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || 'Failed to unapprove artist');
      }
    } catch {
      toast.error('Failed to unapprove artist');
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
        toast.success(data.is_featured ? t('admin.manageArtists.artistFeatured') : t('admin.manageArtists.artistUnfeatured'));
        loadArtists();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || t('admin.manageArtists.failedToUpdateFeaturedStatus'));
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
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || t('admin.manageArtists.failedToDeleteArtist'));
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
      artist.genre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artist.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artist.city?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = !genreFilter || artist.genre === genreFilter;
    const matchesCity = !cityFilter || artist.city?.toLowerCase() === cityFilter.toLowerCase();
    return matchesSearch && matchesGenre && matchesCity;
  });

  const genres = [...new Set(artists.map(a => a.genre).filter(Boolean))];
  const artistCities = [...new Set(artists.map(a => a.city).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <AdminPageHeader chip="Management" title={t('admin.manageArtists.title')} subtitle={t('admin.manageArtists.subtitle')} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d3da0c]/15 text-yellow-700 dark:text-[#d3da0c] rounded-xl">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageArtists.totalArtists')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">{artists.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageArtists.verified')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {artists.filter(a => a.is_verified).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageArtists.totalFollowers')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {artists.reduce((acc, a) => acc + (a.followers_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageArtists.totalEvents')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {artists.reduce((acc, a) => acc + (a.events_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Approved</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {artists.filter(a => a.is_approved).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageArtists.featured')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {artists.filter(a => a.is_featured).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
        <div className="flex-1 relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.manageArtists.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2.5 sm:gap-3">
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="w-full sm:w-auto px-3 sm:px-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c] focus:outline-none"
          >
            <option value="" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.manageArtists.allGenres')}</option>
            {genres.map(g => <option key={g} value={g} className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{g}</option>)}
          </select>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full sm:w-auto px-3 sm:px-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c] focus:outline-none"
          >
            <option value="" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">All Cities</option>
            {artistCities.map(c => (
              <option key={c} value={c} className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Artists Table / Mobile Cards */}
      <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <>
          {/* Mobile Native Cards */}
          <div className="md:hidden divide-y divide-black/5 dark:divide-white/5">
            {filteredArtists.map((artist) => (
              <div key={artist.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => handleViewArtistCard(artist.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-11 h-11 bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] border border-[#d3da0c]/30 rounded-full flex items-center justify-center font-bold shrink-0">
                      {artist.stage_name?.[0] || 'A'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#020b00] dark:text-white font-semibold text-sm truncate">{artist.stage_name}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                        {artist.user_name}{artist.genre ? ` · ${artist.genre}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-semibold ${
                      artist.is_verified || artist.verification_badge ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                    }`}>
                      {artist.is_verified || artist.verification_badge ? 'Verified' : 'Unverified'}
                    </span>
                    {artist.is_featured && (
                      <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-semibold bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">
                        Featured
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {artist.city && (
                    <span className="inline-flex items-center gap-1 text-[#020b00] dark:text-[#d3da0c] font-medium">
                      <MapPin className="w-3 h-3" />
                      {artist.city.charAt(0).toUpperCase() + artist.city.slice(1)}
                    </span>
                  )}
                  <span>{artist.followers_count || 0} followers</span>
                  <span>{artist.events_count || 0} events</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => handleViewArtistCard(artist.id)}
                    className="flex-1 min-w-[5.5rem] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-100 dark:bg-white/[0.06] text-xs font-semibold text-[#020b00] dark:text-white active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#d3da0c]" />
                    Details
                  </button>
                  {!artist.is_verified ? (
                    <button
                      onClick={() => handleVerify(artist.id)}
                      disabled={actionLoading === `verify-${artist.id}`}
                      className="px-3 py-2 rounded-xl bg-green-500/15 text-green-700 dark:text-green-400 text-xs font-semibold"
                    >
                      Verify
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnverify(artist.id)}
                      disabled={actionLoading === `unverify-${artist.id}`}
                      className="px-3 py-2 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 text-xs font-semibold"
                    >
                      Unverify
                    </button>
                  )}
                  <button
                    onClick={() => handleFeature(artist.id)}
                    disabled={actionLoading === `feature-${artist.id}`}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold ${artist.is_featured ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' : 'bg-neutral-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-300'}`}
                  >
                    {artist.is_featured ? 'Featured' : 'Feature'}
                  </button>
                  {!artist.is_approved ? (
                    <button
                      onClick={() => handleApprove(artist.id)}
                      disabled={actionLoading === `approve-${artist.id}`}
                      className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      aria-label="Approve artist"
                    >
                      <Unlock className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnapprove(artist.id)}
                      disabled={actionLoading === `unapprove-${artist.id}`}
                      className="p-2 rounded-xl bg-neutral-100 dark:bg-white/[0.06] text-gray-500"
                      aria-label="Unapprove artist"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-white/5 border-b border-black/8 dark:border-white/10">
              <tr>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageArtists.artist')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageArtists.genre')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageArtists.followers')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageArtists.events')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageArtists.status')}</th>
                <th className="text-right text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageArtists.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filteredArtists.map((artist) => (
                <tr key={artist.id} className="hover:bg-neutral-50/70 dark:hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div 
                      onClick={() => handleViewArtistCard(artist.id)}
                      className="flex items-center gap-3 cursor-pointer group"
                      title="Click to view artist card"
                    >
                      <div className="w-10 h-10 bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] border border-[#d3da0c]/30 rounded-full flex items-center justify-center font-bold group-hover:ring-2 group-hover:ring-[#d3da0c] transition-all">
                        {artist.stage_name?.[0] || 'A'}
                      </div>
                      <div>
                        <p className="text-[#020b00] dark:text-white font-medium group-hover:text-[#d3da0c] transition-colors flex items-center gap-1.5">
                          {artist.stage_name}
                          <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#d3da0c] transition-opacity" />
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5 flex-wrap">
                          <span>{artist.user_name}</span>
                          {artist.city && (
                            <span className="inline-flex items-center gap-0.5 text-[0.6875rem] text-[#020b00] dark:text-[#d3da0c] font-medium bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                              <MapPin className="w-2.5 h-2.5" />
                              {artist.city.charAt(0).toUpperCase() + artist.city.slice(1)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">{artist.genre || t('admin.manageArtists.na')}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">{artist.followers_count || 0}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">{artist.events_count || 0}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${
                        artist.is_verified || artist.verification_badge ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                      }`}>
                        {artist.is_verified || artist.verification_badge ? (t('admin.manageArtists.verifiedStatus') || 'Verified') : (t('admin.manageArtists.unverifiedStatus') || 'Unverified')}
                      </span>
                      {artist.is_approved && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-blue-500/15 text-blue-700 dark:text-blue-400">
                          Approved
                        </span>
                      )}
                      {artist.is_featured && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">
                          {t('admin.manageArtists.featuredBadge')}
                        </span>
                      )}
                      {artist.status === 'suspended' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-red-500/15 text-red-600 dark:text-red-400">
                          Suspended
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewArtistCard(artist.id)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-gray-700 dark:text-gray-300 hover:text-[#d3da0c] transition-colors"
                        title="View Artist Card & Performance"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!artist.is_verified ? (
                        <button
                          onClick={() => handleVerify(artist.id)}
                          disabled={actionLoading === `verify-${artist.id}`}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-green-600 dark:text-green-400 transition-colors"
                          title={t('admin.manageArtists.verify')}
                        >
                          {actionLoading === `verify-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverify(artist.id)}
                          disabled={actionLoading === `unverify-${artist.id}`}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-orange-600 dark:text-orange-400 transition-colors"
                          title="Unverify"
                        >
                          {actionLoading === `unverify-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        </button>
                      )}
                      {!artist.is_approved ? (
                        <button
                          onClick={() => handleApprove(artist.id)}
                          disabled={actionLoading === `approve-${artist.id}`}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
                          title="Approve account"
                        >
                          {actionLoading === `approve-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnapprove(artist.id)}
                          disabled={actionLoading === `unapprove-${artist.id}`}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                          title="Unapprove account"
                        >
                          {actionLoading === `unapprove-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleFeature(artist.id)}
                        disabled={actionLoading === `feature-${artist.id}`}
                        className={`px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors ${artist.is_featured ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}`}
                        title={artist.is_featured ? t('admin.manageArtists.unfeature') : t('admin.manageArtists.feature')}
                      >
                        {actionLoading === `feature-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : (artist.is_featured ? 'Featured' : 'Feature')}
                      </button>
                      {artist.status === 'suspended' ? (
                        <button
                          onClick={() => artist.user_id && handleActivate(artist.user_id)}
                          disabled={actionLoading === `activate-${artist.user_id}` || !artist.user_id}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-green-600 dark:text-green-400 transition-colors"
                          title="Activate account"
                        >
                          {actionLoading === `activate-${artist.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => artist.user_id && handleSuspend(artist.user_id)}
                          disabled={actionLoading === `suspend-${artist.user_id}` || !artist.user_id}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                          title="Suspend account"
                        >
                          {actionLoading === `suspend-${artist.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(artist.id)}
                        disabled={actionLoading === `delete-${artist.id}`}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-red-600 dark:text-red-400 transition-colors"
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
          </div>
          </>
        )}
      </div>
      {/* Artist Detail Modal */}
      <EntityDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedArtistId(null);
        }}
        type="artist"
        entityId={selectedArtistId}
        onUpdated={loadArtists}
      />
    </div>
  );
};

export default ManageArtists;
