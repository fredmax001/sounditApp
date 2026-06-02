import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface StaffMembership {
  id: number;
  business_id: number;
  business_name: string;
  role: string;
  permissions: {
    qrScanner?: boolean;
    checkedInInfo?: boolean;
  };
}

export interface StaffEvent {
  id: number;
  title: string;
  start_date: string;
  city: string;
  flyer_image: string | null;
  organizer_id: number;
}

interface StaffState {
  memberships: StaffMembership[];
  events: StaffEvent[];
  isLoading: boolean;
  fetchMemberships: () => Promise<void>;
  fetchEvents: () => Promise<void>;
  isStaff: () => boolean;
  canScan: () => boolean;
  clear: () => void;
}

export const useStaffStore = create<StaffState>((set, get) => ({
  memberships: [],
  events: [],
  isLoading: false,

  fetchMemberships: async () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/my-memberships`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        set({ memberships: data || [] });
      }
    } catch {
      // silent
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEvents: async () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/my-events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        set({ events: data || [] });
      }
    } catch {
      // silent
    } finally {
      set({ isLoading: false });
    }
  },

  isStaff: () => {
    return get().memberships.length > 0;
  },

  canScan: () => {
    return get().memberships.some(m => m.permissions?.qrScanner === true);
  },

  clear: () => set({ memberships: [], events: [], isLoading: false }),
}));
