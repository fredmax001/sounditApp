import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

export interface StaffAuthState {
  token: string | null;
  staff: {
    id: number;
    full_name: string;
    login: string;
    email: string;
    phone: string | null;
    role: string;
  } | null;
  event: {
    id: number;
    title: string;
    start_date: string | null;
    city: string | null;
    venue: string | null;
    flyer_image: string | null;
  } | null;
  permissions: {
    qrScanner?: boolean;
    checkedInInfo?: boolean;
  };
  isLoading: boolean;
  error: string | null;
  login: (eventUrl: string, emailOrPhone: string, password: string) => Promise<boolean>;
  logout: () => void;
  canScan: () => boolean;
  canViewCheckedIn: () => boolean;
}

export const useStaffAuthStore = create<StaffAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      staff: null,
      event: null,
      permissions: {},
      isLoading: false,
      error: null,

      login: async (eventUrl, emailOrPhone, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_BASE_URL}/business/staff/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_url: eventUrl, email_or_phone: emailOrPhone, password }),
          });

          const data = await res.json();

          if (!res.ok) {
            set({ isLoading: false, error: data.detail || 'Login failed' });
            return false;
          }

          set({
            token: data.access_token,
            staff: data.staff,
            event: data.event,
            permissions: data.permissions || {},
            isLoading: false,
            error: null,
          });
          return true;
        } catch (err: any) {
          set({ isLoading: false, error: err.message || 'Network error' });
          return false;
        }
      },

      logout: () => {
        set({ token: null, staff: null, event: null, permissions: {}, error: null });
      },

      canScan: () => {
        return get().permissions?.qrScanner === true;
      },

      canViewCheckedIn: () => {
        return get().permissions?.checkedInInfo === true;
      },
    }),
    {
      name: 'staff-auth-storage',
      partialize: (state) => ({
        token: state.token,
        staff: state.staff,
        event: state.event,
        permissions: state.permissions,
      }),
    }
  )
);
