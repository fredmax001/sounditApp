import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Heart, 
  Eye,
  Clock,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Grid3X3
} from 'lucide-react';
import { useRecapsStore } from '../store/recapsStore';

interface Recap {
  id: number;
  title: string;
  description?: string;
  photos: string[];
  views_count: number;
  likes_count: number;
  status: string;
  organizer_id: number;
  organizer_name?: string;
  event_id?: number;
  event?: {
    title: string;
    city: string;
  };
  created_at: string;
  published_at?: string;
  user_liked?: boolean;
}

export default function Recaps() {
  const { t } = useTranslation();
  const { recaps, isLoading: loading, fetchRecaps, fetchRecapById, likeRecap } = useRecapsStore();
  const [selectedRecap, setSelectedRecap] = useState<Recap | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    fetchRecaps();
  }, []);

  const openRecap = async (recap: Recap) => {
    try {
      // Fetch full recap details
      await fetchRecapById(recap.id);
      const currentRecap = useRecapsStore.getState().currentRecap;
      setSelectedRecap(currentRecap);
      setSelectedPhotoIndex(0);
    } catch (error) {
      console.error('Failed to load recap details:', error);
    }
  };

  const handleLike = async (e: React.MouseEvent, recapId: number) => {
    e.stopPropagation();
    try {
      await likeRecap(recapId);
    } catch (error) {
      console.error('Failed to like recap:', error);
    }
  };

  const nextPhoto = () => {
    if (selectedRecap && selectedPhotoIndex < selectedRecap.photos.length - 1) {
      setSelectedPhotoIndex(prev => prev + 1);
    }
  };

  const prevPhoto = () => {
    if (selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(prev => prev - 1);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedRecap) return;
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'Escape') setSelectedRecap(null);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRecap, selectedPhotoIndex]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#111] to-[#0a0a0a] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d3da0c]/20 to-[#FF2D8F]/20 flex items-center justify-center">
              <Camera className="w-7 h-7 text-[#d3da0c]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{t('recaps.title')}</h1>
              <p className="text-gray-400">{t('recaps.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recaps.length === 0 ? (
          <div className="text-center py-20">
            <Camera className="w-20 h-20 text-gray-700 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-white mb-3">{t('recaps.noRecapsYet')}</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {t('recaps.noRecapsDescription')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recaps.map((recap, index) => (
              <motion.div
                key={recap.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => openRecap(recap)}
                className="group cursor-pointer bg-[#111] rounded-2xl overflow-hidden hover:ring-2 hover:ring-[#d3da0c]/50 transition-all duration-300"
              >
                {/* Photo Grid Preview */}
                <div className="aspect-square relative overflow-hidden">
                  {recap.photos[0] ? (
                    <img
                      src={recap.photos[0]}
                      alt={recap.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                      <Camera className="w-10 h-10 text-gray-600" />
                    </div>
                  )}
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  
                  {/* Photo Count Badge */}
                  {recap.photos.length > 1 && (
                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Grid3X3 className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs text-white font-medium">
                        {recap.photos.length}
                      </span>
                    </div>
                  )}
                  
                  {/* Stats Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-bold text-lg line-clamp-1 mb-1">
                      {recap.title}
                    </h3>
                    {recap.organizer_name && (
                      <p className="text-gray-300 text-sm">
                        {recap.organizer_name}
                      </p>
                    )}
                    
                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                        <Eye className="w-4 h-4" />
                        <span>{recap.views_count.toLocaleString()}</span>
                      </div>
                      <button 
                        onClick={(e) => handleLike(e, recap.id)}
                        className={`flex items-center gap-1.5 text-sm transition-colors ${
                          recap.user_liked ? 'text-[#FF2D8F]' : 'text-gray-400 hover:text-[#FF2D8F]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${recap.user_liked ? 'fill-current' : ''}`} />
                        <span>{recap.likes_count.toLocaleString()}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Viewer Modal */}
      <AnimatePresence>{selectedRecap && (<motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
              <button
                onClick={() => setSelectedRecap(null)}
                className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>{t('recaps.backToRecaps')}</span>
              </button>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={(e) => handleLike(e, selectedRecap.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                    selectedRecap.user_liked 
                      ? 'bg-[#FF2D8F]/20 text-[#FF2D8F]' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${selectedRecap.user_liked ? 'fill-current' : ''}`} />
                  <span>{selectedRecap.likes_count.toLocaleString()}</span>
                </button>
                <button
                  onClick={() => setSelectedRecap(null)}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex">
              {/* Photo Area */}
              <div className="flex-1 flex items-center justify-center relative bg-black">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={selectedPhotoIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    src={selectedRecap.photos[selectedPhotoIndex]}
                    alt={`${t('recaps.photo')} ${selectedPhotoIndex + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </AnimatePresence>

                {/* Navigation Arrows */}
                {selectedRecap.photos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      disabled={selectedPhotoIndex === 0}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-6 h-6 text-white" />
                    </button>
                    <button
                      onClick={nextPhoto}
                      disabled={selectedPhotoIndex === selectedRecap.photos.length - 1}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-6 h-6 text-white" />
                    </button>
                  </>
                )}

                {/* Photo Counter */}
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
                  <span className="text-white font-medium">
                    {selectedPhotoIndex + 1} / {selectedRecap.photos.length}
                  </span>
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="w-80 bg-[#111] border-l border-white/10 p-6 overflow-y-auto">
                <h2 className="text-xl font-bold text-white mb-2">{selectedRecap.title}</h2>
                
                {selectedRecap.description && (
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                    {selectedRecap.description}
                  </p>
                )}

                <div className="space-y-4 mb-6">
                  {selectedRecap.organizer_name && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <div className="w-8 h-8 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center">
                        <Camera className="w-4 h-4 text-[#d3da0c]" />
                      </div>
                      <span className="text-sm">{selectedRecap.organizer_name}</span>
                    </div>
                  )}
                  
                  {selectedRecap.event?.city && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <div className="w-8 h-8 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-[#d3da0c]" />
                      </div>
                      <span className="text-sm">{selectedRecap.event.city}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-8 h-8 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-[#d3da0c]" />
                    </div>
                    <span className="text-sm">
                      {new Date(selectedRecap.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-[#1a1a1a] rounded-xl mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{selectedRecap.views_count.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{t('recaps.views')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#FF2D8F]">{selectedRecap.likes_count.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{t('recaps.likes')}</div>
                  </div>
                </div>

                {/* Thumbnail Strip */}
                {selectedRecap.photos.length > 1 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">{t('recaps.photos')}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {selectedRecap.photos.map((photo, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedPhotoIndex(idx)}
                          className={`aspect-square rounded-lg overflow-hidden transition-all ${
                            idx === selectedPhotoIndex
                              ? 'ring-2 ring-[#d3da0c]'
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={photo}
                            alt={`${t('recaps.thumbnail')} ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
