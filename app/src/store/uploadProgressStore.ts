import { create } from 'zustand';

export type UploadTaskStatus = 'uploading' | 'processing' | 'completed' | 'error';

export interface UploadProgressTask {
  id: string;
  title: string;
  subtitle?: string;
  progress: number; // 0-100
  status: UploadTaskStatus;
  actionUrl?: string;
  actionLabel?: string;
  errorMessage?: string;
}

interface UploadProgressStore {
  tasks: UploadProgressTask[];
  startTask: (id: string, title: string, subtitle?: string) => void;
  updateProgress: (id: string, progress: number, subtitle?: string, status?: UploadTaskStatus) => void;
  completeTask: (id: string, subtitle?: string, actionUrl?: string, actionLabel?: string) => void;
  failTask: (id: string, errorMessage: string) => void;
  dismissTask: (id: string) => void;
}

export const useUploadProgressStore = create<UploadProgressStore>((set) => ({
  tasks: [],

  startTask: (id, title, subtitle) =>
    set((state) => ({
      tasks: [
        ...state.tasks.filter((t) => t.id !== id),
        { id, title, subtitle, progress: 5, status: 'uploading' },
      ],
    })),

  updateProgress: (id, progress, subtitle, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              progress: Math.max(0, Math.min(100, Math.round(progress))),
              ...(subtitle !== undefined ? { subtitle } : {}),
              ...(status ? { status } : {}),
            }
          : t
      ),
    })),

  completeTask: (id, subtitle, actionUrl, actionLabel) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              progress: 100,
              status: 'completed',
              subtitle: subtitle || 'Published successfully',
              actionUrl,
              actionLabel,
            }
          : t
      ),
    }));
    window.setTimeout(() => {
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    }, 6000);
  },

  failTask: (id, errorMessage) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'error',
              errorMessage,
            }
          : t
      ),
    })),

  dismissTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    })),
}));
