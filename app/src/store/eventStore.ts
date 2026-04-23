import { create } from 'zustand';
import axios from 'axios';
import { useAuthStore } from './authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } }; message?: string };
    return e.response?.data?.detail || e.message || 'Unknown error';
  }
  return 'Unknown error';
}

function getApiErrorDetail(err: unknown, fallback = 'Unknown error'): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } } };
    return e.response?.data?.detail || fallback;
  }
  return fallback;
}


// Helper to get auth token (checks multiple possible keys)
const getAuthToken = () => {
  // Try to get token from authStore first (most reliable)
  const token = useAuthStore.getState().session?.access_token;
  if (token) return token;

  // Fallback to localStorage
  return localStorage.getItem('auth-token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('auth-token') || localStorage.getItem('token');
};

// Helper to format error messages
const formatErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  const errObj = error as { response?: { data?: { detail?: string | unknown[] } }; message?: string };
  if (errObj.response?.data?.detail) {
    const detail = errObj.response.data.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((e) => (typeof e === 'string' ? e : (e as { msg?: string }).msg) || String(e)).join(', ');
    }
    return JSON.stringify(detail);
  }
  return errObj.message || 'An unexpected error occurred';
};

// ============================================
// TYPES
// ============================================
export interface Event {
  id: string;
  title: string;
  title_cn?: string;
  description: string;
  description_cn?: string;
  start_date: string;
  end_date?: string;
  city: string;
  address?: string;
  flyer_image: string;
  gallery_images?: string[];
  capacity?: number;
  tickets_sold: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'live';
  views_count: number;
  is_featured: boolean;
  business_id: string;
  venue_id?: string;
  category?: string;
  tags?: string[];
  ticket_tiers?: TicketTier[];
  wechat_qr_url?: string;
  alipay_qr_url?: string;
  ticket_price?: number;
  payment_instructions?: string;
  event_type?: string;
  refund_policy?: string;
  require_id?: boolean;
  qr_code?: string;
  share_url?: string;
  organizer_plan?: string;
  created_at: string;
}

export interface EventWithDetails extends Event {
  business?: {
    id: string;
    user_id: string;
    business_name: string;
    logo_url?: string;
    verified: boolean;
    verification_badge?: boolean;
  };
  venue?: {
    id: string;
    name: string;
    address: string;
  };
  ticket_tiers?: TicketTier[];
  djs?: DJ[];
  artist_djs?: DJ[];
}

export interface TicketTier {
  id: string;
  name: string;
  name_cn?: string;
  description?: string;
  price: number;
  currency: string;
  quantity: number;
  quantity_sold: number;
  max_per_order: number;
  status: 'available' | 'sold_out' | 'limited' | 'paused';
  sale_start?: string;
  sale_end?: string;
}

export interface DJ {
  id: string;
  stage_name: string;
  avatar_url?: string;
  genres?: string[];
  verification_badge?: boolean;
}

export interface EventState {
  events: EventWithDetails[];
  featuredEvents: EventWithDetails[];
  savedEvents: EventWithDetails[];
  currentEvent: EventWithDetails | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchEvents: (filters?: EventFilters) => Promise<void>;
  fetchEventById: (id: string) => Promise<void>;
  fetchEventsByCity: (city: string) => Promise<void>;
  fetchFeaturedEvents: (city?: string) => Promise<void>;
  createEvent: (data: CreateEventData) => Promise<Event>;
  updateEvent: (id: string, data: Partial<Event>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  incrementViews: (id: string) => Promise<void>;
  saveEvent: (eventId: string) => Promise<void>;
  unsaveEvent: (eventId: string) => Promise<void>;
  fetchMyEvents: () => Promise<void>;
  fetchSavedEvents: () => Promise<void>;
  addTicketTier: (eventId: string, tierData: Omit<TicketTier, 'id' | 'quantity_sold'>) => Promise<void>;
  updateTicketTier: (tierId: string, tierData: Partial<TicketTier>) => Promise<void>;
  deleteTicketTier: (tierId: string) => Promise<void>;
  uploadEventFlyer: (file: File) => Promise<string>;
}

export interface EventFilters {
  city?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  featured?: boolean;
  category?: string;
  search?: string;
}

export interface CreateEventData {
  title: string;
  description: string;
  start_date: string;
  city: string;
  flyer_image: string;
  business_id: string;
  venue_id?: string;
  capacity?: number;
  end_date?: string;
  address?: string;
  ticket_tiers?: Omit<TicketTier, 'id' | 'quantity_sold'>[];
  status?: Event['status'];
}

// ============================================
// EVENT STORE - PRODUCTION VERSION
// ============================================
export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  featuredEvents: [],
  savedEvents: [],
  currentEvent: null,
  isLoading: false,
  error: null,

  // Fetch events with optional filters
  fetchEvents: async (filters?: EventFilters) => {
    set({ isLoading: true, error: null });

    try {
      const params: Record<string, unknown> = {};
      if (filters?.city) params.city = filters.city;
      if (filters?.startDate) params.date_from = filters.startDate;
      if (filters?.endDate) params.date_to = filters.endDate;
      if (filters?.status) params.status = filters.status;
      if (filters?.category) params.category = filters.category;
      if (filters?.search) params.search = filters.search;

      const response = await axios.get(`${API_URL}/events`, { params });
      set({ events: response.data || [], isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Fetch single event by ID
  fetchEventById: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await axios.get(`${API_URL}/events/${id}`);
      set({ currentEvent: response.data, isLoading: false });

      // Increment views in background
      get().incrementViews(id);
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Fetch events by city
  fetchEventsByCity: async (city: string) => {
    await get().fetchEvents({ city });
  },

  // Fetch featured events
  fetchFeaturedEvents: async (city?: string) => {
    set({ isLoading: true, error: null });

    try {
      const params: Record<string, unknown> = {};
      if (city) params.city = city;

      const response = await axios.get(`${API_URL}/events/featured`, { params });
      set({ featuredEvents: response.data || [], isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Create new event
  createEvent: async (data: CreateEventData) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.post(`${API_URL}/events`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Update event
  updateEvent: async (id: string, data: Partial<Event>) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.put(`${API_URL}/events/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refresh current event if it's the one being updated
      const { currentEvent } = get();
      if (currentEvent?.id === id) {
        set({ currentEvent: { ...currentEvent, ...response.data } });
      }

      set({ isLoading: false });
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Delete event
  deleteEvent: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      await axios.delete(`${API_URL}/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({
        events: get().events.filter(e => e.id !== id),
        isLoading: false
      });
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Increment event views by loading the event details endpoint
  incrementViews: async (id: string) => {
    try {
      await axios.get(`${API_URL}/events/${id}`);
    } catch (error) {
      // Silent fail - views are not critical
      console.error('Failed to increment views:', error);
    }
  },

  // Save event for user
  saveEvent: async (eventId: string) => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      await axios.post(`${API_URL}/events/${eventId}/save`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Optimistically add to savedEvents if currentEvent matches
      const { currentEvent } = get();
      if (currentEvent && String(currentEvent.id) === eventId) {
        set((state) => ({
          savedEvents: state.savedEvents.some((e) => String(e.id) === eventId)
            ? state.savedEvents
            : [...state.savedEvents, currentEvent]
        }));
      }
    } catch (error: unknown) {
      throw new Error(getApiErrorDetail(error, 'Failed to save event'));
    }
  },

  // Unsave event
  unsaveEvent: async (eventId: string) => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      await axios.delete(`${API_URL}/events/${eventId}/save`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set((state) => ({
        savedEvents: state.savedEvents.filter((e) => String(e.id) !== eventId)
      }));
    } catch (error: unknown) {
      throw new Error(getApiErrorDetail(error, 'Failed to unsave event'));
    }
  },

  // Fetch organizer's own events
  fetchMyEvents: async () => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await axios.get(`${API_URL}/events/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ events: response.data || [], isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Fetch user's saved events
  fetchSavedEvents: async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        set({ savedEvents: [] });
        return;
      }

      const response = await axios.get(`${API_URL}/events/saved`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ savedEvents: response.data || [] });
    } catch (error: unknown) {
      set({ savedEvents: [] });
    }
  },

  // Add ticket tier to event
  addTicketTier: async (eventId: string, tierData: Omit<TicketTier, 'id' | 'quantity_sold'>) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      await axios.post(`${API_URL}/events/${eventId}/ticket-tiers`, tierData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refresh current event
      const { currentEvent } = get();
      if (currentEvent?.id === eventId) {
        await get().fetchEventById(eventId);
      }

      set({ isLoading: false });
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Update ticket tier
  updateTicketTier: async (tierId: string, tierData: Partial<TicketTier>) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      await axios.patch(`${API_URL}/events/ticket-tiers/${tierId}`, tierData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refresh current event if applicable
      const { currentEvent } = get();
      if (currentEvent) {
        await get().fetchEventById(currentEvent.id);
      }

      set({ isLoading: false });
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Delete ticket tier
  deleteTicketTier: async (tierId: string) => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      await axios.delete(`${API_URL}/events/ticket-tiers/${tierId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refresh current event if applicable
      const { currentEvent } = get();
      if (currentEvent) {
        await get().fetchEventById(currentEvent.id);
      }

      set({ isLoading: false });
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Upload event flyer image
  uploadEventFlyer: async (file: File): Promise<string> => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file');
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB
        throw new Error('Image size must be less than 10MB');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/media/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        }
      });

      return response.data.url;
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error) || 'Failed to upload flyer');
    }
  },
}));

export default useEventStore;
