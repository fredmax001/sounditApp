import { create } from 'zustand';
import { API_BASE_URL } from '@/config/api';
import { isNativeMobileApp } from '@/lib/platform';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action_url: string;
}

export interface OnboardingStateData {
  user_id?: number;
  role?: string;
  version: number;
  is_first_time_eligible: boolean;
  completed: boolean;
  completed_at?: string | null;
  skipped: boolean;
  current_step: number;
  wizard_completed: boolean;
  selected_interests: string[];
  preferred_city?: string | null;
  preferred_language?: string;
  permissions_prompted: Record<string, string>;
  coach_marks_seen: string[];
  tour_completed: boolean;
  checklist_dismissed: boolean;
  checklist: ChecklistItem[];
  checklist_progress: { completed: number; total: number; percent: number };
}

const DEFAULT_STATE: OnboardingStateData = {
  version: 2,
  is_first_time_eligible: false,
  completed: false,
  completed_at: null,
  skipped: false,
  current_step: 0,
  wizard_completed: false,
  selected_interests: [],
  preferred_city: null,
  preferred_language: 'en',
  permissions_prompted: {},
  coach_marks_seen: [],
  tour_completed: false,
  checklist_dismissed: false,
  checklist: [],
  checklist_progress: { completed: 0, total: 0, percent: 0 },
};

function cacheKey(userId: string | number) {
  return `soundit_onboarding_user_${userId}`;
}

function getToken(): string | null {
  try {
    return (
      localStorage.getItem('auth-token') ||
      localStorage.getItem('token') ||
      JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.session?.access_token ||
      null
    );
  } catch {
    return null;
  }
}

interface OnboardingStore {
  data: OnboardingStateData;
  loadedForUserId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  tourActive: boolean;

  fetchState: (userId?: string | number | null) => Promise<OnboardingStateData | null>;
  initNewNativeUser: () => Promise<OnboardingStateData | null>;
  saveProgress: (patch: Partial<{
    current_step: number;
    wizard_completed: boolean;
    selected_interests: string[];
    preferred_city: string;
    preferred_language: string;
    permissions_prompted: Record<string, string>;
    coach_marks_seen: string[];
    tour_completed: boolean;
    checklist_dismissed: boolean;
    skipped: boolean;
  }>) => Promise<OnboardingStateData | null>;
  completeOnboarding: (payload?: { selected_interests?: string[]; preferred_city?: string; skipped?: boolean }) => Promise<OnboardingStateData | null>;
  startTour: () => void;
  stopTour: () => void;
  resetLocalSession: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  data: DEFAULT_STATE,
  loadedForUserId: null,
  isLoading: false,
  isSaving: false,
  tourActive: false,

  fetchState: async (userId) => {
    // Strictly native-only: never run onboarding state queries on web/PWA
    if (!isNativeMobileApp()) return null;
    const token = getToken();
    if (!token) return null;

    // Hydrate from per-user cache immediately for offline resilience
    if (userId) {
      try {
        const cached = localStorage.getItem(cacheKey(userId));
        if (cached) {
          set({ data: { ...DEFAULT_STATE, ...JSON.parse(cached) } });
        }
      } catch { /* ignore */ }
    }

    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/onboarding/state`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const serverData: OnboardingStateData = await res.json();
      set({
        data: { ...DEFAULT_STATE, ...serverData },
        loadedForUserId: String(serverData.user_id || userId || ''),
      });
      if (serverData.user_id) {
        try {
          localStorage.setItem(cacheKey(serverData.user_id), JSON.stringify(serverData));
          if (serverData.completed) {
            localStorage.setItem('soundit_onboarding_completed', 'true');
          }
        } catch { /* ignore */ }
      }
      return serverData;
    } catch {
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  initNewNativeUser: async () => {
    if (!isNativeMobileApp()) return null;
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/onboarding/init-new-user`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const serverData: OnboardingStateData = await res.json();
      set({
        data: { ...DEFAULT_STATE, ...serverData },
        loadedForUserId: String(serverData.user_id || ''),
      });
      if (serverData.user_id) {
        try {
          localStorage.setItem(cacheKey(serverData.user_id), JSON.stringify(serverData));
        } catch { /* ignore */ }
      }
      return serverData;
    } catch {
      return null;
    }
  },

  saveProgress: async (patch) => {
    if (!isNativeMobileApp()) return null;
    const token = getToken();
    const prev = get().data;
    const optimistic: OnboardingStateData = {
      ...prev,
      ...patch,
      permissions_prompted: {
        ...prev.permissions_prompted,
        ...(patch.permissions_prompted || {}),
      },
      coach_marks_seen: patch.coach_marks_seen
        ? Array.from(new Set([...prev.coach_marks_seen, ...patch.coach_marks_seen]))
        : prev.coach_marks_seen,
    };
    set({ data: optimistic, isSaving: true });
    if (optimistic.user_id) {
      try {
        localStorage.setItem(cacheKey(optimistic.user_id), JSON.stringify(optimistic));
      } catch { /* ignore */ }
    }

    if (!token) {
      set({ isSaving: false });
      return optimistic;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/onboarding/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return optimistic;
      const serverData: OnboardingStateData = await res.json();
      set({ data: { ...DEFAULT_STATE, ...serverData } });
      if (serverData.user_id) {
        try {
          localStorage.setItem(cacheKey(serverData.user_id), JSON.stringify(serverData));
        } catch { /* ignore */ }
      }
      return serverData;
    } catch {
      return optimistic;
    } finally {
      set({ isSaving: false });
    }
  },

  completeOnboarding: async (payload = {}) => {
    if (!isNativeMobileApp()) return null;
    const token = getToken();
    try {
      localStorage.setItem('soundit_onboarding_completed', 'true');
    } catch { /* ignore */ }

    const prev = get().data;
    const optimistic: OnboardingStateData = {
      ...prev,
      completed: true,
      wizard_completed: true,
      is_first_time_eligible: false,
      skipped: Boolean(payload.skipped),
      selected_interests: payload.selected_interests || prev.selected_interests,
    };
    set({ data: optimistic, isSaving: true });
    if (optimistic.user_id) {
      try {
        localStorage.setItem(cacheKey(optimistic.user_id), JSON.stringify(optimistic));
      } catch { /* ignore */ }
    }

    if (!token) {
      set({ isSaving: false });
      return optimistic;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return optimistic;
      const serverData: OnboardingStateData = await res.json();
      set({ data: { ...DEFAULT_STATE, ...serverData } });
      if (serverData.user_id) {
        try {
          localStorage.setItem(cacheKey(serverData.user_id), JSON.stringify(serverData));
        } catch { /* ignore */ }
      }
      return serverData;
    } catch {
      return optimistic;
    } finally {
      set({ isSaving: false });
    }
  },

  startTour: () => {
    if (isNativeMobileApp()) set({ tourActive: true });
  },

  stopTour: () => set({ tourActive: false }),

  resetLocalSession: () => {
    // Only clears in-memory React state on logout — NEVER clears persisted completion!
    set({ data: DEFAULT_STATE, loadedForUserId: null, tourActive: false });
  },
}));
