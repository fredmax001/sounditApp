import { create } from 'zustand';

export interface Track {
  id: string | number;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  audio_url?: string;
  cover_image?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  playlist: Track[];
  isPlaying: boolean;
  progress: number; // 0 to 100
  currentTime: number;
  duration: number;
  
  // Actions
  playTrack: (track: Track, playlist?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setProgress: (progress: number, currentTime: number) => void;
  setDuration: (duration: number) => void;
  clearPlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  playlist: [],
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,

  playTrack: (track, playlist) => {
    set((state) => ({
      currentTrack: track,
      playlist: playlist || state.playlist || [track],
      isPlaying: true,
      progress: 0,
      currentTime: 0,
    }));
  },

  pause: () => set({ isPlaying: false }),

  resume: () => {
    const { currentTrack } = get();
    if (currentTrack) {
      set({ isPlaying: true });
    }
  },

  nextTrack: () => {
    const { currentTrack, playlist } = get();
    if (!currentTrack || playlist.length <= 1) return;
    
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    
    set({
      currentTrack: playlist[nextIndex],
      isPlaying: true,
      progress: 0,
      currentTime: 0,
    });
  },

  prevTrack: () => {
    const { currentTrack, playlist, currentTime } = get();
    if (!currentTrack || playlist.length <= 1) return;

    // If played more than 3 seconds, just restart track
    if (currentTime > 3) {
      set({ progress: 0, currentTime: 0 });
      return;
    }
    
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
    
    set({
      currentTrack: playlist[prevIndex],
      isPlaying: true,
      progress: 0,
      currentTime: 0,
    });
  },

  setProgress: (progress, currentTime) => set({ progress, currentTime }),
  
  setDuration: (duration) => set({ duration }),

  clearPlayer: () => set({
    currentTrack: null,
    playlist: [],
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0
  })
}));
