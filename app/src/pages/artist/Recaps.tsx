import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Eye,
  Music,
  Share2,
  Loader2,
  Film
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    event_name: '',
    type: 'image' as 'video' | 'image',
    media_url: ''
  });

  const loadRecaps = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/artist/recaps`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setRecaps(data || []);
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
    if (!formData.title.trim()) {
      toast.error('Please enter a recap title');
      return;
    }
    setUploading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/artist/recaps`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          event_name: formData.event_name.trim(),
          photos: formData.media_url ? [formData.media_url.trim()] : []
        })
      });

      if (res.ok) {
        toast.success(t('artist.recaps.uploadSuccess') || 'Recap published successfully!');
        setShowUploadModal(false);
        setFormData({ title: '', event_name: '', type: 'image', media_url: '' });
        loadRecaps();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || t('artist.recaps.uploadFailed') || 'Failed to upload recap');
      }
    } catch {
      toast.error(t('artist.recaps.uploadError') || 'Network error uploading recap');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('artist.recaps.deleteConfirm') || 'Are you sure you want to delete this recap?')) return;
    setDeletingId(id);

    try {
      const res = await fetch(`${API_BASE_URL}/artist/recaps/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('artist.recaps.deleteSuccess') || 'Recap deleted');
        setRecaps(prev => prev.filter(r => r.id !== id));
      } else {
        toast.error('Failed to delete recap');
      }
    } catch {
      toast.error(t('artist.recaps.deleteFailed') || 'Error deleting recap');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '–';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const totalRecaps = recaps.length;
  const videosCount = recaps.filter(r => r.type === 'video').length;
  const imagesCount = recaps.filter(r => r.type === 'image').length;
  const totalViews = recaps.reduce((acc, r) => acc + (r.views || 0), 0);

  return (
    <div className="min-h-dvh bg-[#020b00] text-white pb-[calc(6rem+env(safe-area-inset-bottom,24px))] pt-2 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header & Glowing 3D Camera / Film Reel SVG */}
      <div className="flex items-start justify-between gap-4 pt-2 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Recaps
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1.5 max-w-[17.5rem] sm:max-w-md leading-relaxed">
            Showcase your stage moments, performance videos, and live gig highlights to organizers.
          </p>
        </div>

        {/* 3D Glowing Camera / Film Reel Vector Illustration */}
        <div className="relative shrink-0 w-20 h-16 sm:w-24 sm:h-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/25 blur-xl rounded-full" />
          <svg
            className="w-16 h-16 sm:w-20 sm:h-20 relative z-10 drop-shadow-[0_0_16px_rgba(16,185,129,0.55)]"
            viewBox="0 0 100 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="recapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            {/* Film Clapboard / Camera Body */}
            <rect x="18" y="24" width="64" height="42" rx="8" fill="#0b140b" stroke="#34d399" strokeWidth="1.5" />
            {/* Lens circle */}
            <circle cx="50" cy="45" r="14" fill="url(#recapGrad)" />
            <circle cx="50" cy="45" r="8" fill="#020b00" />
            <circle cx="50" cy="45" r="4" fill="#d3da0c" />
            {/* Flash / Sensor */}
            <rect x="26" y="30" width="8" height="6" rx="2" fill="#d3da0c" />
            {/* Top clapboard stripes */}
            <path d="M22 18 L78 18 L74 24 L26 24 Z" fill="url(#recapGrad)" opacity="0.8" />
          </svg>
        </div>
      </div>

      {/* Action Workspace Cards (3 Cards) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 mb-6">
        <Link
          to="/dashboard/artist/performances"
          className="bg-[#0b140b] hover:bg-[#111e11] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all group active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 group-hover:scale-105 transition-transform">
            <Music className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-semibold text-white/90 leading-tight">
              Performances
            </span>
            <span className="text-[0.625rem] text-gray-500 mt-0.5 block">
              Gigs History
            </span>
          </div>
        </Link>

        <Link
          to="/dashboard/artist/community"
          className="bg-[#0b140b] hover:bg-[#111e11] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all group active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 group-hover:scale-105 transition-transform">
            <Film className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-semibold text-white/90 leading-tight">
              Fan Feed
            </span>
            <span className="text-[0.625rem] text-gray-500 mt-0.5 block">
              Community Posts
            </span>
          </div>
        </Link>

        {/* Neon-lime Primary Upload Action */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-[#d3da0c] hover:bg-[#c2c80b] text-black rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all shadow-[0_0_20px_rgba(211,218,12,0.25)] active:scale-[0.98] text-left cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center mb-2 text-black">
            <Plus className="w-4 h-4 text-black stroke-[3]" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-bold leading-tight">
              Add Recap
            </span>
            <span className="text-[0.625rem] text-black/70 mt-0.5 block font-medium">
              Upload Media
            </span>
          </div>
        </button>
      </div>

      {/* 2x2 Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mb-6">
        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Video className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Total Recaps</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {totalRecaps}
          </p>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <FileVideo className="w-4 h-4 text-[#d3da0c]" />
            <span className="text-xs font-medium">Video Clips</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#d3da0c]">
            {videosCount}
          </p>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Stage Photos</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {imagesCount}
          </p>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium">Total Views</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-blue-400">
            {totalViews.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Recaps Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Published Recaps
          </h2>
          <span className="text-xs text-gray-400">
            {totalRecaps} {totalRecaps === 1 ? 'Recap' : 'Recaps'}
          </span>
        </div>

        {loading ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#d3da0c] mx-auto mb-3 animate-spin" />
            <p className="text-xs text-gray-400">Loading published recaps...</p>
          </div>
        ) : recaps.length === 0 ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-12 text-center">
            <Video className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-white font-medium text-sm">No recaps published yet</p>
            <p className="text-gray-400 text-xs mt-1 max-w-sm mx-auto">
              Share your gig performance highlights, DJ drops, and event recaps to build your profile credibility.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(211,218,12,0.25)]"
            >
              <Plus className="w-4 h-4" /> Publish First Recap
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {recaps.map((recap, index) => (
              <motion.div
                key={recap.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-[#0b140b] border border-white/8 hover:border-emerald-500/30 rounded-2xl overflow-hidden transition-all shadow-xs flex flex-col justify-between"
              >
                {/* Media Thumbnail */}
                <div className="relative aspect-video bg-[#050e03] overflow-hidden group">
                  {recap.thumbnail_url || recap.url ? (
                    <img
                      src={recap.thumbnail_url || recap.url}
                      alt={recap.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/default-event.png';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-950/20 text-emerald-400">
                      <Film className="w-10 h-10 opacity-40" />
                    </div>
                  )}

                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[0.625rem] font-bold text-white flex items-center gap-1 border border-white/10 capitalize">
                    {recap.type === 'video' ? <Play className="w-2.5 h-2.5 fill-current" /> : <ImageIcon className="w-2.5 h-2.5" />}
                    {recap.type}
                  </div>

                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[0.625rem] font-medium text-gray-300 flex items-center gap-1 border border-white/10">
                    <Eye className="w-2.5 h-2.5" />
                    {recap.views || 0}
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-3.5 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-1 mb-0.5">
                      {recap.title}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-1 mb-2">
                      {recap.event_name || 'Sound It Live Event'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[0.6875rem] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      {formatDate(recap.created_at)}
                    </span>

                    <button
                      onClick={() => handleDelete(recap.id)}
                      disabled={deletingId === recap.id}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete Recap"
                    >
                      {deletingId === recap.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Recap Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0e160d] rounded-2xl border border-white/10 shadow-2xl p-6 w-full max-w-md text-white"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Publish Event Recap</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Recap Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Closing DJ Set Live in Shanghai"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Event Name / Venue
                  </label>
                  <input
                    type="text"
                    value={formData.event_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_name: e.target.value }))}
                    placeholder="e.g. AFTER 90s Halloween Party"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Image / Thumbnail URL
                  </label>
                  <input
                    type="url"
                    value={formData.media_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, media_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#d3da0c] hover:bg-[#c2c80b] text-black flex items-center gap-1.5 shadow-[0_0_12px_rgba(211,218,12,0.3)] disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Publish Recap
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
