import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  Grid3X3,
  Calendar,
  Sparkles
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
  const [searchParams, setSearchParams] = useSearchParams();
  const eventIdParam = searchParams.get('event_id');
  const { recaps, isLoading: loading, fetchRecaps, fetchRecapById, likeRecap } = useRecapsStore();
  const [selectedRecap, setSelectedRecap] = useState<Recap | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    fetchRecaps();
  }, [fetchRecaps]);

  const displayedRecaps = eventIdParam
    ? recaps.filter(r => String(r.event_id) === String(eventIdParam))
    : recaps;

  // Auto-open if event_id param matches a single recap
  useEffect(() => {
    if (eventIdParam && displayedRecaps.length === 1 && !selectedRecap) {
      openRecap(displayedRecaps[0]);
    }
  }, [eventIdParam, displayedRecaps.length]);

  const openRecap = async (recap: Recap) => {
    try {
      await fetchRecapById(recap.id);
      const currentRecap = useRecapsStore.getState().currentRecap;
      setSelectedRecap(currentRecap || recap);
      setSelectedPhotoIndex(0);
    } catch (error) {
      console.error('Failed to load recap details:', error);
      setSelectedRecap(recap);
      setSelectedPhotoIndex(0);
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
    <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white transition-colors duration-200 pb-20">
      {/* Header */}
      <div className="bg-neutral-50 dark:bg-gradient-to-b dark:from-[#111] dark:to-[#020b00] border-b border-black/8 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-[#d3da0c] mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Events
          </Link>

          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d3da0c]/20 to-[#FF2D8F]/20 flex items-center justify-center">
              <Camera className="w-7 h-7 text-[#d3da0c]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#020b00] dark:text-white">{t('recaps.title') || 'Event Recaps'}</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{t('recaps.subtitle') || 'Relive the best moments, crowd photos and highlights from our events'}</p>
            </div>
          </div>

          {eventIdParam && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] text-xs font-semibold border border-[#d3da0c]/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Filtered by Event #{eventIdParam}</span>
              <button
                onClick={() => setSearchParams({})}
                className="w-4 h-4 rounded-full bg-black/20 dark:bg-white/20 flex items-center justify-center hover:scale-110 ml-1"
                aria-label="Clear filter"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-[#020b00] dark:border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedRecaps.length === 0 ? (
          <div className="text-center py-20">
            <Camera className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl md:text-2xl font-bold text-[#020b00] dark:text-white mb-2">
              {t('recaps.noRecapsYet') || 'No recaps published yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm mb-6">
              {t('recaps.noRecapsDescription') || 'Event photos, videos and highlights are added right after each event. Check back soon!'}
            </p>
            <Link
              to="/events"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold text-xs"
            >
              <Calendar className="w-4 h-4" />
              Explore All Events
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedRecaps.map((recap, index) => (
              <motion.div
                key={recap.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => openRecap(recap)}
                className="group cursor-pointer bg-neutral-50 dark:bg-[#111] border border-black/8 dark:border-white/5 rounded-2xl overflow-hidden hover:ring-2 hover:ring-[#d3da0c]/50 transition-all duration-300 shadow-xs dark:shadow-none"
              >
                {/* Photo Grid Preview */}
                <div className="aspect-square relative overflow-hidden">
                  {recap.photos && recap.photos[0] ? (
                    <img
                      src={recap.photos[0]}
                      alt={recap.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-200 dark:bg-[#1a1a1a]">
                      <Camera className="w-10 h-10 text-gray-500 dark:text-gray-600" />
                    </div>
                  )}
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  
                  {/* Photo Count Badge */}
                  {recap.photos && recap.photos.length > 1 && (
                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 border border-white/10">
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
                      <div className="flex items-center gap-1.5 text-gray-300 text-sm">
                        <Eye className="w-4 h-4" />
                        <span>{(recap.views_count || 0).toLocaleString()}</span>
                      </div>
                      <button 
                        onClick={(e) => handleLike(e, recap.id)}
                        className={`flex items-center gap-1.5 text-sm transition-colors ${
                          recap.user_liked ? 'text-[#FF2D8F]' : 'text-gray-300 hover:text-[#FF2D8F]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${recap.user_liked ? 'fill-current' : ''}`} />
                        <span>{(recap.likes_count || 0).toLocaleString()}</span>
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
      <AnimatePresence>
        {selectedRecap && (
          <motion.div
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
                <span>{t('recaps.backToRecaps') || 'Back'}</span>
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
                  <span>{(selectedRecap.likes_count || 0).toLocaleString()}</span>
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
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Photo Area */}
              <div className="flex-1 flex items-center justify-center relative bg-black min-h-[50vh]">
                <AnimatePresence mode="wait">
                  {selectedRecap.photos && selectedRecap.photos[selectedPhotoIndex] && (
                    <motion.img
                      key={selectedPhotoIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      src={selectedRecap.photos[selectedPhotoIndex]}
                      alt={`${t('recaps.photo') || 'Photo'} ${selectedPhotoIndex + 1}`}
                      className="max-h-full max-w-full object-contain p-2"
                    />
                  )}
                </AnimatePresence>

                {/* Navigation Arrows */}
                {selectedRecap.photos && selectedRecap.photos.length > 1 && (
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
                {selectedRecap.photos && (
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
                    <span className="text-white font-medium text-xs">
                      {selectedPhotoIndex + 1} / {selectedRecap.photos.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Sidebar Info */}
              <div className="w-full md:w-80 bg-[#111] border-t md:border-t-0 md:border-l border-white/10 p-6 overflow-y-auto max-h-[40vh] md:max-h-full">
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
                      <Link
                        to={`/profiles/${selectedRecap.organizer_id}`}
                        className="text-sm font-medium text-white hover:text-[#d3da0c] transition-colors underline-offset-2 hover:underline"
                      >
                        {selectedRecap.organizer_name}
                      </Link>
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
                <div className="grid grid-cols-2 gap-4 p-4 bg-[#1a1a1a] rounded-xl mb-6 border border-white/5">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{(selectedRecap.views_count || 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{t('recaps.views') || 'Views'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#FF2D8F]">{(selectedRecap.likes_count || 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{t('recaps.likes') || 'Likes'}</div>
                  </div>
                </div>

                {/* Thumbnail Strip */}
                {selectedRecap.photos && selectedRecap.photos.length > 1 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">{t('recaps.photos') || 'All Photos'}</h3>
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
                            alt={`${t('recaps.thumbnail') || 'Thumbnail'} ${idx + 1}`}
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
