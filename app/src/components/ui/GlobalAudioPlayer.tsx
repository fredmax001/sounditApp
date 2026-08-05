import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, X, Music } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';

const GlobalAudioPlayer = () => {
  const { 
    currentTrack, 
    isPlaying, 
    progress, 
    playTrack, 
    pause, 
    resume, 
    nextTrack, 
    clearPlayer,
    setProgress,
    setDuration 
  } = usePlayerStore();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync audio element with store state
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error('Audio play error:', e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration || 1;
      setProgress((current / total) * 100, current);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    nextTrack();
  };

  return (
    <>
      {/* Hidden Audio Element */}
      {currentTrack && currentTrack.audio_url && (
        <audio
          ref={audioRef}
          src={currentTrack.audio_url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}

      {/* Floating Mini Player UI */}
      <AnimatePresence>
        {currentTrack && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-[90px] left-2 right-2 md:left-auto md:right-4 md:w-80 bg-[#1A1A1A]/95 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 shadow-2xl z-50 flex items-center gap-3 touch-none"
          >
            {/* Album Art */}
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/50 border border-white/5 flex items-center justify-center">
              {currentTrack.cover_image ? (
                <img src={currentTrack.cover_image} alt={currentTrack.title} className="w-full h-full object-cover" />
              ) : (
                <Music className="w-5 h-5 text-gray-500" />
              )}
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-white text-sm font-semibold truncate leading-tight">
                {currentTrack.title}
              </p>
              <p className="text-[#d3da0c] text-[10px] truncate leading-tight">
                {currentTrack.artist}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={isPlaying ? pause : resume}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
              </button>
              <button 
                onClick={nextTrack}
                className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white active:scale-95 transition-all"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <button 
                onClick={clearPlayer}
                className="w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:text-red-400 active:scale-95 transition-all ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar (Absolute bottom) */}
            <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#d3da0c] transition-all duration-300 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalAudioPlayer;
