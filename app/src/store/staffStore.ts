import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

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

let isFetchingMemberships = false;
let lastMembershipsFetch = 0;

export const useStaffStore = create<StaffState>((set, get) => ({
  memberships: [],
  events: [],
  isLoading: false,

  fetchMemberships: async () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    const now = Date.now();
    if (isFetchingMemberships || (now - lastMembershipsFetch < 45000 && get().memberships.length > 0)) {
      return;
    }
    isFetchingMemberships = true;
    lastMembershipsFetch = now;
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
      isFetchingMemberships = false;
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
