import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Camera,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  Calendar,
  User
} from 'lucide-react';
import { useRecapsStore } from '../../store/recapsStore';
import type { Recap } from '../../store/recapsStore';

export default function ManageRecaps() {
  const { t } = useTranslation();
  const {
    recaps,
    isLoading,
    fetchAllRecaps,
    approveRecap,
    rejectRecap
  } = useRecapsStore();

  const [filter, setFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecap, setSelectedRecap] = useState<Recap | null>(null);

  useEffect(() => {
    fetchAllRecaps({ status: filter !== 'all' ? filter : undefined });
  }, [filter]);

  const handleApprove = async (id: number) => {
    try {
      await approveRecap(id);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Enter rejection reason (optional):');
    try {
      await rejectRecap(id, reason || undefined);
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const filteredRecaps = recaps.filter(recap =>
    recap.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recap.organizer_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: recaps.length,
    pending: recaps.filter(r => r.status === 'pending').length,
    published: recaps.filter(r => r.status === 'published').length,
    rejected: recaps.filter(r => r.status === 'rejected').length
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <Camera className="w-8 h-8 text-[#d3da0c]" />
          {t('admin.manageRecaps.title')}
        </h1>
        <p className="text-gray-400">{t('admin.manageRecaps.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#111] rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-gray-500">{t('admin.manageRecaps.total')}</div>
        </div>
        <div className="bg-[#111] rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          <div className="text-sm text-gray-500">{t('admin.manageRecaps.pending')}</div>
        </div>
        <div className="bg-[#111] rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-green-500">{stats.published}</div>
          <div className="text-sm text-gray-500">{t('admin.manageRecaps.published')}</div>
        </div>
        <div className="bg-[#111] rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
          <div className="text-sm text-gray-500">{t('admin.manageRecaps.rejected')}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.manageRecaps.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'published', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${filter === status
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-[#111] text-gray-400 hover:text-white border border-white/10'
                }`}
            >
              {t(`admin.manageRecaps.filter.${status}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Recaps List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredRecaps.length === 0 ? (
        <div className="text-center py-20 bg-[#111] rounded-2xl border border-white/5">
          <Camera className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">{t('admin.manageRecaps.noRecapsFound')}</h3>
          <p className="text-gray-400">
            {filter === 'pending'
              ? t('admin.manageRecaps.noRecapsAwaiting')
              : t('admin.manageRecaps.noRecapsMatch')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRecaps.map((recap) => (
            <motion.div
              key={recap.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden"
            >
              <div className="flex">
                {/* Photo Preview */}
                <div
                  className="w-40 h-40 flex-shrink-0 relative cursor-pointer"
                  onClick={() => setSelectedRecap(recap)}
                >
                  {recap.photos[0] ? (
                    <img
                      src={recap.photos[0]}
                      alt={recap.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                      <Camera className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded-full">
                    <span className="text-xs text-white">{recap.photos.length}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-white font-semibold line-clamp-1">{recap.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${recap.status === 'published' ? 'bg-green-500/20 text-green-500' :
                        recap.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                          recap.status === 'rejected' ? 'bg-red-500/20 text-red-500' :
                            'bg-gray-500/20 text-gray-500'
                      }`}>
                      {recap.status}
                    </span>
                  </div>

                  {recap.organizer_name && (
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm mb-2">
                      <User className="w-3.5 h-3.5" />
                      {recap.organizer_name}
                    </div>
                  )}

                  {recap.event?.city && (
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm mb-3">
                      <Calendar className="w-3.5 h-3.5" />
                      {recap.event.city}
                    </div>
                  )}

                  {/* Actions */}
                  {recap.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleApprove(recap.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg text-sm font-medium hover:bg-green-500/20 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(recap.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRecap && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#111] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h2 className="text-xl font-bold text-white">{selectedRecap.title}</h2>
              <button
                onClick={() => setSelectedRecap(null)}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-100px)]">
              {selectedRecap.description && (
                <p className="text-gray-300 mb-4">{selectedRecap.description}</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedRecap.photos.map((photo: string, idx: number) => (
                  <div key={idx} className="aspect-square rounded-xl overflow-hidden">
                    <img
                      src={photo}
                      alt={`${t('admin.manageRecaps.photo')} ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
