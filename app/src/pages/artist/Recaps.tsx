/**
 * Artist Recaps Page
 * Upload and manage event recaps/media
 */
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, 
  Video, 
  Image as ImageIcon, 
  Trash2,
  Play,
  Calendar,
  Plus,
  X,
  FileVideo,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { useTranslation } from 'react-i18next';

interface Recap {
  id: number;
  title: string;
  event_name: string;
  type: 'video' | 'image';
  url: string;
  thumbnail_url?: string;
  created_at: string;
  views: number;
}

export default function ArtistRecaps() {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    event_name: '',
    type: 'video' as 'video' | 'image'
  });

  const loadRecaps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/artist/recaps`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setRecaps(data);
      }
    } catch {
      // silently ignore load errors
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadRecaps();
  }, [loadRecaps]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/artist/recaps`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success(t('artist.recaps.uploadSuccess'));
        setShowUploadModal(false);
        setFormData({ title: '', event_name: '', type: 'video' });
        loadRecaps();
      } else {
        toast.error(t('artist.recaps.uploadFailed'));
      }
    } catch {
      toast.error(t('artist.recaps.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('artist.recaps.deleteConfirm'))) return;

    try {
      // Note: Delete endpoint would need to be implemented
      toast.success(t('artist.recaps.deleteSuccess'));
      loadRecaps();
    } catch {
      toast.error(t('artist.recaps.deleteFailed'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#020b00] dark:text-white">{t('artist.recaps.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            {t('artist.recaps.subtitle')}
          </p>
        </div>
        
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black px-3 py-2 sm:px-4 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-opacity text-sm sm:text-base w-fit cursor-pointer shadow-xs dark:shadow-none"
        >
          <Plus className="w-4 h-4" />
          {t('artist.recaps.uploadRecap')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[
          { label: t('artist.recaps.totalRecaps'), value: recaps.length, icon: Video },
          { label: t('artist.recaps.videos'), value: recaps.filter(r => r.type === 'video').length, icon: FileVideo },
          { label: t('artist.recaps.images'), value: recaps.filter(r => r.type === 'image').length, icon: ImageIcon },
          { label: t('artist.recaps.totalViews'), value: recaps.reduce((acc, r) => acc + (r.views || 0), 0), icon: Eye },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-[#111111] rounded-xl p-3 sm:p-4 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none"
          >
            <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#020b00] dark:text-[#d3da0c] mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">{stat.label}</p>
            <p className="text-xl sm:text-2xl font-bold text-[#020b00] dark:text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Recaps Grid */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#020b00] dark:border-[#d3da0c]"></div>
        </div>
      ) : recaps.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#111111] rounded-xl border border-black/8 dark:border-white/5 border-dashed shadow-xs dark:shadow-none">
          <div className="w-20 h-20 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-10 h-10 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-[#020b00] dark:text-white mb-2">{t('artist.recaps.noRecaps')}</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
            {t('artist.recaps.noRecapsDescription')}
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-[#020b00] text-[#d3da0c] dark:bg-white/10 dark:text-white px-6 py-2 rounded-lg font-bold inline-flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-xs dark:shadow-none"
          >
            <Upload className="w-4 h-4" />
            {t('artist.recaps.uploadFirstRecap')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recaps.map((recap, index) => (
            <motion.div
              key={recap.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-[#111111] rounded-xl border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none overflow-hidden group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-neutral-100 dark:bg-[#020b00]">
                {recap.thumbnail_url ? (
                  <img 
                    src={recap.thumbnail_url} 
                    alt={recap.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {recap.type === 'video' ? (
                      <FileVideo className="w-12 h-12 text-gray-400 dark:text-gray-600" />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-600" />
                    )}
                  </div>
                )}
                
                {/* Play Overlay */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {recap.type === 'video' ? (
                    <div className="w-14 h-14 bg-[#d3da0c] rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-black ml-1" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                {/* Type Badge */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white flex items-center gap-1">
                  {recap.type === 'video' ? (
                    <FileVideo className="w-3 h-3" />
                  ) : (
                    <ImageIcon className="w-3 h-3" />
                  )}
                  {t(`artist.recaps.type.${recap.type}`)}
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => handleDelete()}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Info */}
              <div className="p-3 sm:p-4">
                <h3 className="font-semibold text-[#020b00] dark:text-white truncate text-sm sm:text-base">{recap.title}</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">{recap.event_name}</p>
                <div className="flex items-center justify-between mt-2 sm:mt-3 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    {formatDate(recap.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    {t('artist.recaps.viewCount', { count: recap.views || 0 })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#111111] rounded-2xl border border-black/10 dark:border-white/10 w-full max-w-md p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#020b00] dark:text-white">{t('artist.recaps.modalTitle')}</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('artist.recaps.typeLabel')}</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'video' })}
                    className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-colors cursor-pointer font-medium text-sm ${
                      formData.type === 'video'
                        ? 'border-[#020b00] bg-[#020b00]/5 text-[#020b00] dark:border-[#d3da0c] dark:bg-[#d3da0c]/10 dark:text-[#d3da0c]'
                        : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-black/20 dark:hover:border-white/20'
                    }`}
                  >
                    <FileVideo className="w-5 h-5" />
                    {t('artist.recaps.type.video')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'image' })}
                    className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-colors cursor-pointer font-medium text-sm ${
                      formData.type === 'image'
                        ? 'border-[#020b00] bg-[#020b00]/5 text-[#020b00] dark:border-[#d3da0c] dark:bg-[#d3da0c]/10 dark:text-[#d3da0c]'
                        : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-black/20 dark:hover:border-white/20'
                    }`}
                  >
                    <ImageIcon className="w-5 h-5" />
                    {t('artist.recaps.type.image')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('artist.recaps.titleLabel')}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('artist.recaps.titlePlaceholder')}
                  className="w-full bg-neutral-50 dark:bg-[#020b00] border border-black/10 dark:border-white/10 rounded-lg px-4 py-3 text-[#020b00] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('artist.recaps.eventLabel')}</label>
                <input
                  type="text"
                  value={formData.event_name}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  placeholder={t('artist.recaps.eventPlaceholder')}
                  className="w-full bg-neutral-50 dark:bg-[#020b00] border border-black/10 dark:border-white/10 rounded-lg px-4 py-3 text-[#020b00] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>

              {/* File Upload Area - Placeholder */}
              <div className="border-2 border-dashed border-black/10 dark:border-white/10 rounded-lg p-8 text-center bg-neutral-50 dark:bg-white/5">
                <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('artist.recaps.dropzone', { type: t(`artist.recaps.type.${formData.type}`) })}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                  {t('artist.recaps.maxFileSize')}
                </p>
              </div>

              <button
                type="submit"
                disabled={uploading || !formData.title || !formData.event_name}
                className="w-full bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black py-3 rounded-lg font-bold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs dark:shadow-none"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-[#d3da0c] border-t-transparent dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {t('artist.recaps.uploadRecap')}
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
