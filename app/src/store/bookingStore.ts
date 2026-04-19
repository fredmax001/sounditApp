import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface Booking {
    id: number;
    status: string;
    event_name?: string;
    venue?: string;
    event_location?: string;
    proposed_date?: string;
    event_date?: string;
    duration?: string | number;
    rating?: number;
    agreed_price?: number;
    budget?: number;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    message?: string;
    event_city?: string;
    event_type?: string;
    requester_name?: string;
    duration_hours?: number;
}



function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } }; message?: string };
    return e.response?.data?.detail || e.message || 'Unknown error';
  }
  return 'Unknown error';
}


export const BookingStatus = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled'
} as const;

export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus];

interface BookingState {
    bookings: Booking[];
    incomingBookings: Booking[];
    myBookings: Booking[];
    isLoading: boolean;
    error: string | null;
    fetchIncomingBookings: (token: string) => Promise<void>;
    fetchMyBookings: (token: string) => Promise<void>;
    createBooking: (token: string, bookingData: unknown) => Promise<boolean>;
    updateBookingStatus: (token: string, id: number, status: BookingStatus, agreedPrice?: number) => Promise<boolean>;
    sendMessage: (token: string, bookingId: number, message: string) => Promise<boolean>;
    fetchMessages: (token: string, bookingId: number) => Promise<unknown[]>;
}

export const useBookingStore = create<BookingState>((set, get) => ({
    bookings: [],
    incomingBookings: [],
    myBookings: [],
    isLoading: false,
    error: null,

    // Fetch bookings for artists (incoming requests)
    fetchIncomingBookings: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/bookings/requests/incoming`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ incomingBookings: response.data, isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    // Fetch bookings for users (my requests)
    fetchMyBookings: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/bookings/requests/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ myBookings: response.data, isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
        }
    },

    createBooking: async (token, bookingData) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/bookings/requests`, bookingData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ isLoading: false });
            return true;
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
            return false;
        }
    },

    updateBookingStatus: async (token, id, status, agreedPrice) => {
        set({ isLoading: true, error: null });
        try {
            const payload: Record<string, unknown> = { status };
            if (agreedPrice) payload.agreed_price = agreedPrice;

            await axios.put(`${API_URL}/bookings/requests/${id}/status`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh both lists
            await get().fetchIncomingBookings(token);
            await get().fetchMyBookings(token);
            set({ isLoading: false });
            return true;
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
            return false;
        }
    },

    sendMessage: async (token, bookingId, message) => {
        set({ isLoading: true, error: null });
        try {
            await axios.post(`${API_URL}/bookings/requests/${bookingId}/messages`,
                { message },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            set({ isLoading: false });
            return true;
        } catch (err: unknown) {
            set({ error: getErrorMessage(err), isLoading: false });
            return false;
        }
    },

    fetchMessages: async (token, bookingId) => {
        try {
            const response = await axios.get(`${API_URL}/bookings/requests/${bookingId}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        } catch (err: unknown) {
            set({ error: getErrorMessage(err) });
            return [];
        }
    },
}));
