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


export interface VerificationRequest {
    id: string;
    user_id: string;
    user_email?: string;
    user_name?: string;
    request_type: 'business' | 'artist' | 'identity';
    status: 'pending' | 'approved' | 'rejected';
    submitted_at: string;
    reviewed_at?: string;
    reviewed_by?: string;
    rejection_reason?: string;
    documents?: string[];
    [key: string]: unknown;
}

export interface Payout {
    id: string;
    user_id: string;
    user_email?: string;
    user_name?: string;
    amount: number;
    currency: string;
    status: 'pending' | 'approved' | 'rejected' | 'released';
    requested_at: string;
    processed_at?: string;
    payment_method?: string;
    notes?: string;
}

export interface AdminUser {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    role: string;
    status: 'active' | 'suspended' | 'frozen';
    created_at: string;
    last_login?: string;
    is_verified: boolean;
}

interface AdminState {
    commissionRates: Record<string, number>;
    systemFlags: {
        maintenanceMode: boolean;
        featuredEventLimit: number;
        allowNewRegistrations: boolean;
    };
    verificationRequests: VerificationRequest[];
    featuredEventIds: string[];
    disabledEventIds: string[];
    payouts: Payout[];
    escrowBalance: number;
    releasedTotal: number;
    users: AdminUser[];
    frozenUserIds: string[];
    isLoading: boolean;
    error: string | null;

    // Commission & System
    fetchCommissionRates: (token: string) => Promise<void>;
    updateCommissionRate: (token: string, city: string, rate: number) => Promise<void>;
    fetchSystemFlags: (token: string) => Promise<void>;
    toggleMaintenance: (token: string) => Promise<void>;
    setSystemFlag: (token: string, flag: string, value: unknown) => Promise<void>;

    // Events
    fetchFeaturedEvents: (token: string) => Promise<void>;
    featureEvent: (token: string, id: string) => Promise<void>;
    unfeatureEvent: (token: string, id: string) => Promise<void>;
    fetchDisabledEvents: (token: string) => Promise<void>;
    toggleEventVisibility: (token: string, id: string) => Promise<void>;

    // Verifications
    fetchVerificationRequests: (token: string, status?: string) => Promise<void>;
    approveVerification: (token: string, id: string) => Promise<void>;
    rejectVerification: (token: string, id: string, reason?: string) => Promise<void>;

    // Payouts
    fetchPayouts: (token: string, status?: string) => Promise<void>;
    fetchEscrowStats: (token: string) => Promise<void>;
    approvePayout: (token: string, id: string) => Promise<void>;
    rejectPayout: (token: string, id: string, reason?: string) => Promise<void>;
    releasePayout: (token: string, id: string) => Promise<void>;

    // Users
    fetchUsers: (token: string, filters?: Record<string, unknown>) => Promise<void>;
    freezeUser: (token: string, id: string) => Promise<void>;
    unfreezeUser: (token: string, id: string) => Promise<void>;
    suspendUser: (token: string, id: string, reason?: string) => Promise<void>;
    activateUser: (token: string, id: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
    commissionRates: {},
    systemFlags: {
        maintenanceMode: false,
        featuredEventLimit: 6,
        allowNewRegistrations: true,
    },
    verificationRequests: [],
    featuredEventIds: [],
    disabledEventIds: [],
    payouts: [],
    escrowBalance: 0,
    releasedTotal: 0,
    users: [],
    frozenUserIds: [],
    isLoading: false,
    error: null,

    // ============================================
    // COMMISSION & SYSTEM
    // ============================================
    fetchCommissionRates: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/admin/commission-rates`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ commissionRates: response.data.rates || {}, isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    updateCommissionRate: async (token, city, rate) => {
        set({ isLoading: true, error: null });
        try {
            await axios.put(`${API_URL}/admin/commission-rates/${city}`, { rate }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                commissionRates: { ...state.commissionRates, [city]: rate },
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    fetchSystemFlags: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/admin/system-flags`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ systemFlags: response.data, isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    toggleMaintenance: async (token) => {
        const newMode = !get().systemFlags.maintenanceMode;
        set({ isLoading: true, error: null });
        try {
            await axios.put(`${API_URL}/admin/system-flags/maintenance`, { enabled: newMode }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                systemFlags: { ...state.systemFlags, maintenanceMode: newMode },
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    setSystemFlag: async (token, flag, value) => {
        set({ isLoading: true, error: null });
        try {
            await axios.put(`${API_URL}/admin/system-flags/${flag}`, { value }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                systemFlags: { ...state.systemFlags, [flag]: value },
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    // ============================================
    // EVENTS
    // ============================================
    fetchFeaturedEvents: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/admin/featured-events`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ featuredEventIds: response.data.map((e: { id: string }) => e.id) || [], isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    featureEvent: async (token, id) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/events/${id}/feature`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                featuredEventIds: [...state.featuredEventIds, id],
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    unfeatureEvent: async (token, id) => {
        set({ isLoading: true, error: null });
        try {
            await axios.delete(`${API_URL}/admin/events/${id}/feature`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                featuredEventIds: state.featuredEventIds.filter(pid => pid !== id),
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    fetchDisabledEvents: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/admin/disabled-events`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ disabledEventIds: response.data.map((e: { id: string }) => e.id) || [], isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    toggleEventVisibility: async (token, id) => {
        const isDisabled = get().disabledEventIds.includes(id);
        set({ isLoading: true, error: null });
        try {
            if (isDisabled) {
                await axios.post(`${API_URL}/admin/events/${id}/enable`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                set((state) => ({
                    disabledEventIds: state.disabledEventIds.filter(pid => pid !== id),
                    isLoading: false
                }));
            } else {
                await axios.post(`${API_URL}/admin/events/${id}/disable`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                set((state) => ({
                    disabledEventIds: [...state.disabledEventIds, id],
                    isLoading: false
                }));
            }
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    // ============================================
    // VERIFICATIONS
    // ============================================
    fetchVerificationRequests: async (token, status = 'pending') => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/admin/verifications`, {
                params: { status },
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ verificationRequests: response.data || [], isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    approveVerification: async (token, id) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/verifications/${id}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                verificationRequests: state.verificationRequests.map(v =>
                    v.id === id ? { ...v, status: 'approved' } : v
                ),
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    rejectVerification: async (token, id, reason) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/verifications/${id}/reject`, { reason }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                verificationRequests: state.verificationRequests.map(v =>
                    v.id === id ? { ...v, status: 'rejected', rejection_reason: reason } : v
                ),
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    // ============================================
    // PAYOUTS
    // ============================================
    fetchPayouts: async (token, status) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/admin/payouts`, {
                params: status ? { status } : {},
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ payouts: response.data || [], isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    fetchEscrowStats: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/admin/escrow-stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({
                escrowBalance: response.data.escrow_balance || 0,
                releasedTotal: response.data.released_total || 0,
                isLoading: false
            });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    approvePayout: async (token, id) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/payouts/${id}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                payouts: state.payouts.map(p =>
                    p.id === id ? { ...p, status: 'approved' } : p
                ),
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    rejectPayout: async (token, id, reason) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/payouts/${id}/reject`, { reason }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                payouts: state.payouts.map(p =>
                    p.id === id ? { ...p, status: 'rejected', notes: reason } : p
                ),
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    releasePayout: async (token, id) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/payouts/${id}/release`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                payouts: state.payouts.map(p =>
                    p.id === id ? { ...p, status: 'released' } : p
                ),
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    // ============================================
    // USERS
    // ============================================
    fetchUsers: async (token, filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/admin/users`, {
                params: filters,
                headers: { Authorization: `Bearer ${token}` }
            });
            // Handle both array response and wrapped response
            const usersData = response.data;
            const users = Array.isArray(usersData) ? usersData : (usersData.users || []);
            set({
                users,
                frozenUserIds: users.filter((u: AdminUser) => u.status === 'frozen').map((u: AdminUser) => u.id),
                isLoading: false
            });
        } catch (err: unknown) {
            console.error('[AdminStore] fetchUsers error:', getErrorMessage(err));
            set({ error: getErrorMessage(err), isLoading: false, users: [] });
        }
    },

    freezeUser: async (token, id) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/users/${id}/freeze`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                users: state.users.map(u =>
                    u.id === id ? { ...u, status: 'frozen' } : u
                ),
                frozenUserIds: [...state.frozenUserIds, id],
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    unfreezeUser: async (token, id) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/users/${id}/unfreeze`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                users: state.users.map(u =>
                    u.id === id ? { ...u, status: 'active' } : u
                ),
                frozenUserIds: state.frozenUserIds.filter(uid => uid !== id),
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    suspendUser: async (token, id, reason) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/users/${id}/suspend`, { reason }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                users: state.users.map(u =>
                    u.id === id ? { ...u, status: 'suspended' } : u
                ),
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    activateUser: async (token, id) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/admin/users/${id}/activate`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set((state) => ({
                users: state.users.map(u =>
                    u.id === id ? { ...u, status: 'active' } : u
                ),
                frozenUserIds: state.frozenUserIds.filter(uid => uid !== id),
                isLoading: false
            }));
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },
}));
