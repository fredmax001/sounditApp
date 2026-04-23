import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } }; message?: string };
    return e.response?.data?.detail || e.message || 'Unknown error';
  }
  return 'Unknown error';
}


export interface Activity {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    status: string;
    customer?: string;
    customer_name?: string;
    product?: string;
    product_name?: string;
    qty?: number;
    quantity?: number;
    total?: number;
    amount?: number;
    created_at?: string;
}

export interface DashboardStats {
    role: string;
    business_stats?: {
        total_events: number;
        tickets_sold: number;
        total_revenue: number;
        platform_commission: number;
        net_earnings: number;
        pending_artist_payments: number;
        followers_count?: number;
    };
    artist_stats?: {
        followers: number;
        rating: number;
        total_gigs: number;
        earnings: number;
    };
    vendor_stats?: {
        total_sales: number;
        active_listings: number;
        pending_orders: number;
        event_booths: number;
    };
}

interface DashboardState {
    stats: DashboardStats | null;
    activities: Activity[];
    isLoading: boolean;
    error: string | null;

    fetchStats: (token: string) => Promise<void>;
    fetchActivities: (token: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
    stats: null,
    activities: [],
    isLoading: false,
    error: null,

    fetchStats: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/dashboard/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ stats: response.data, isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    fetchActivities: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/dashboard/recent-activities`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ activities: response.data, isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    }
}));
