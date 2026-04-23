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

  const handleDelete = async (id: string | number) => {
    if (!confirm(t('artist.recaps.deleteConfirm'))) return;

    try {
      const token = localStorage.getItem('auth-token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/recaps/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Delete failed');
      }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('artist.recaps.title')}</h1>
          <p className="text-gray-400 mt-1">
            {t('artist.recaps.subtitle')}
          </p>
        </div>
        
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-[#d3da0c] hover:bg-[#d3da0c]/90 text-black px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('artist.recaps.uploadRecap')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
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
            className="bg-[#111111] rounded-xl p-4 border border-white/5"
          >
            <stat.icon className="w-5 h-5 text-[#d3da0c] mb-2" />
            <p className="text-gray-400 text-sm">{stat.label}</p>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Recaps Grid */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d3da0c]"></div>
        </div>
      ) : recaps.length === 0 ? (
        <div className="text-center py-16 bg-[#111111] rounded-xl border border-white/5 border-dashed">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-10 h-10 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">{t('artist.recaps.noRecaps')}</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            {t('artist.recaps.noRecapsDescription')}
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium inline-flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {t('artist.recaps.uploadFirstRecap')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recaps.map((recap, index) => (
            <motion.div
              key={recap.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="bg-[#111111] rounded-xl border border-white/5 overflow-hidden group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-[#0A0A0A]">
                {recap.thumbnail_url ? (
                  <img 
                    src={recap.thumbnail_url} 
                    alt={recap.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {recap.type === 'video' ? (
                      <FileVideo className="w-12 h-12 text-gray-600" />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-gray-600" />
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
                  onClick={() => handleDelete(recap.id)}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-medium text-white truncate">{recap.title}</h3>
                <p className="text-sm text-gray-400 mt-1">{recap.event_name}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(recap.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
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
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] rounded-xl border border-white/10 w-full max-w-md p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{t('artist.recaps.modalTitle')}</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('artist.recaps.typeLabel')}</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'video' })}
                    className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                      formData.type === 'video'
                        ? 'border-[#d3da0c] bg-[#d3da0c]/10 text-[#d3da0c]'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <FileVideo className="w-5 h-5" />
                    {t('artist.recaps.type.video')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'image' })}
                    className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                      formData.type === 'image'
                        ? 'border-[#d3da0c] bg-[#d3da0c]/10 text-[#d3da0c]'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <ImageIcon className="w-5 h-5" />
                    {t('artist.recaps.type.image')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('artist.recaps.titleLabel')}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('artist.recaps.titlePlaceholder')}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('artist.recaps.eventLabel')}</label>
                <input
                  type="text"
                  value={formData.event_name}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  placeholder={t('artist.recaps.eventPlaceholder')}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>

              {/* File Upload Area - Placeholder */}
              <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center">
                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  {t('artist.recaps.dropzone', { type: t(`artist.recaps.type.${formData.type}`) })}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {t('artist.recaps.maxFileSize')}
                </p>
              </div>

              <button
                type="submit"
                disabled={uploading || !formData.title || !formData.event_name}
                className="w-full bg-[#d3da0c] hover:bg-[#d3da0c]/90 disabled:bg-[#d3da0c]/50 text-black py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
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
