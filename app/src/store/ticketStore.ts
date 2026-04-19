import { create } from 'zustand';
import axios from 'axios';
import { useAuthStore } from './authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function getApiErrorDetail(err: unknown, fallback = 'Unknown error'): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } } };
    return e.response?.data?.detail || fallback;
  }
  return fallback;
}


function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } }; message?: string };
    return e.response?.data?.detail || e.message || 'Unknown error';
  }
  return 'Unknown error';
}


// ============================================
// TYPES
// ============================================
export interface Ticket {
  id: string;
  order_id: string;
  user_id: string;
  ticket_tier_id: string;
  event_id: string;
  ticket_number: string;
  qr_code: string;
  attendee_name: string;
  attendee_email: string;
  is_used: boolean;
  used_at?: string;
  created_at: string;

  // Joined data
  event?: {
    id: string;
    title: string;
    start_date: string;
    flyer_image: string;
    city: string;
  };
  ticket_tier?: {
    name: string;
    price: number;
  };
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  event_id: string;
  total_amount: number;
  currency: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded';
  created_at: string;

  event?: {
    title: string;
    start_date: string;
    flyer_image: string;
    city: string;
  };
  tickets?: Ticket[];
}

export interface TicketState {
  tickets: Ticket[];
  orders: Order[];
  currentTicket: Ticket | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchUserTickets: () => Promise<void>;
  fetchUserOrders: () => Promise<void>;
  fetchTicketById: (id: string) => Promise<void>;
  createOrder: (data: CreateOrderData) => Promise<Order>;
  purchaseTicket: (data: PurchaseTicketData) => Promise<Ticket[]>;
  validateTicket: (ticketNumber: string) => Promise<Ticket | null>;
  checkInTicket: (ticketId: string) => Promise<void>;
  transferTicket: (ticketId: string, newOwnerEmail: string) => Promise<void>;
  downloadTicket: (ticketId: string) => Promise<Blob>;
  requestRefund: (orderId: string, reason?: string) => Promise<boolean>;
}

export interface CreateOrderData {
  event_id: string;
  items: {
    ticket_tier_id: string;
    quantity: number;
  }[];
  attendee_info: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface PurchaseTicketData {
  order_id: string;
  payment_intent_id: string;
}

// Helper to get auth token
const getAuthToken = () => {
  // Try to get token from authStore first (most reliable)
  const token = useAuthStore.getState().session?.access_token;
  if (token) return token;

  // Fallback to localStorage
  return localStorage.getItem('auth-token') || localStorage.getItem('token');
};

// ============================================
// TICKET STORE - PRODUCTION VERSION
// ============================================
export const useTicketStore = create<TicketState>((set) => ({
  tickets: [],
  orders: [],
  currentTicket: null,
  isLoading: false,
  error: null,

  // Fetch user's tickets
  fetchUserTickets: async () => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.get(`${API_URL}/payments/tickets/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ tickets: response.data || [], isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Fetch user's orders
  fetchUserOrders: async () => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.get(`${API_URL}/payments/orders/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ orders: response.data || [], isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Fetch single ticket
  fetchTicketById: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.get(`${API_URL}/payments/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ currentTicket: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Create order (before payment)
  createOrder: async (data: CreateOrderData) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.post(`${API_URL}/payments/orders`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Complete purchase after payment
  purchaseTicket: async (data: PurchaseTicketData) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.post(`${API_URL}/payments/orders/purchase`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Validate ticket (for door staff)
  validateTicket: async (ticketNumber: string) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.get(`${API_URL}/payments/tickets/validate/${ticketNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
      return null;
    }
  },

  // Check in ticket
  checkInTicket: async (ticketId: string) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      await axios.post(`${API_URL}/payments/tickets/${ticketId}/check-in`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ isLoading: false });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Transfer ticket to another user
  transferTicket: async (ticketId: string, newOwnerEmail: string) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      await axios.post(`${API_URL}/payments/tickets/${ticketId}/transfer`,
        { email: newOwnerEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      set({ isLoading: false });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Download ticket as PDF
  downloadTicket: async (ticketId: string) => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.get(`${API_URL}/payments/tickets/${ticketId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      return response.data;
    } catch (error: unknown) {
      console.error('Failed to download ticket:', error);
      throw new Error(getApiErrorDetail(error, 'Failed to download ticket'));
    }
  },

  // Request refund for an order
  requestRefund: async (orderId: string, reason?: string) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      await axios.post(`${API_URL}/payments/orders/${orderId}/refund`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      set({ isLoading: false });
      return true;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },
}));

export default useTicketStore;
