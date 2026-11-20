import { create } from 'zustand';
import axios from 'axios';
import { useAuthStore } from './authStore';
import { queryCache, isAbortError } from '@/lib/queryCache';

const API_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';
const inFlightSaves = new Set<string>();

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
  slug?: string;
  title: string;
  title_cn?: string;
  description: string;
  description_cn?: string;
  start_date: string;
  end_date?: string;
  city: string;
  city_name?: string;
  venue_name?: string;
  address?: string;
  flyer_image: string;
  banner_url?: string;
  cover_image?: string;
  gallery_images?: string[];
  photo_album_url?: string;
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
  show_remaining_tickets?: boolean;
  ticket_sales_closed?: boolean;
  wechat_qr_url?: string;
  alipay_qr_url?: string;
  ticket_price?: number;
  payment_instructions?: string;
  event_type?: string;
  refund_policy?: string;
  refunds_allowed?: boolean;
  require_id?: boolean;
  qr_code?: string;
  share_url?: string;
  organizer_plan?: string;
  promoter_enabled?: boolean;
  default_commission_rate?: number;
  default_discount_percent?: number;
  max_discount_amount?: number;
  created_at: string;
}

export interface EventWithDetails extends Event {
  business?: {
    id: string;
    slug?: string;
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
  status: 'available' | 'sold_out' | 'limited' | 'paused' | 'closed' | 'ended';
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
  fetchPastEvents: (city?: string) => Promise<void>;
  createEvent: (data: CreateEventData) => Promise<Event>;
  updateEvent: (id: string, data: Partial<Event>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  incrementViews: (id: string) => Promise<void>;
  saveEvent: (eventId: string) => Promise<void>;
  unsaveEvent: (eventId: string) => Promise<void>;
  fetchMyEvents: (scope?: 'upcoming' | 'past') => Promise<void>;
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
  includePast?: boolean;
}

export interface CreateEventData {
  title: string;
  description: string;
  start_date: string;
  city: string;
  flyer_image: string;
  gallery_images?: string[];
  photo_album_url?: string;
  business_id: string;
  venue_id?: string;
  capacity?: number;
  end_date?: string;
  address?: string;
  ticket_tiers?: Omit<TicketTier, 'id' | 'quantity_sold'>[];
  status?: Event['status'];
  promoter_enabled?: boolean;
  default_commission_rate?: number;
  default_discount_percent?: number;
  max_discount_amount?: number;
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

  // Fetch events with optional filters (city-isolated cache + AbortController cancellation + deduplication)
  fetchEvents: async (filters?: EventFilters) => {
    const cityKey = queryCache.normalizeCity(filters?.city);
    const params: Record<string, unknown> = {};
    if (cityKey !== 'all') params.city = cityKey;
    if (filters?.startDate) params.date_from = filters.startDate;
    if (filters?.endDate) params.date_to = filters.endDate;
    if (filters?.status) params.status = filters.status;
    if (filters?.category) params.category = filters.category;
    if (filters?.search) params.search = filters.search;
    if (filters?.includePast) params.include_past = true;

    const cacheKey = `events:list:${cityKey}:${JSON.stringify(params)}`;
    const cached = queryCache.get<EventWithDetails[]>(cacheKey);
    if (cached !== null) {
      set({ events: cached, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await queryCache.fetchJson<EventWithDetails[]>(
        cacheKey,
        `${API_URL}/events`,
        {
          params,
          ttlMs: 35_000,
          scope: 'city:events-list',
        }
      );
      set({ events: Array.isArray(data) ? data : [], isLoading: false });
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Fetch single event by ID (backend increments views via BackgroundTasks — no duplicate GET needed)
  fetchEventById: async (id: string) => {
    const cacheKey = `events:detail:${id}`;
    const cached = queryCache.get<EventWithDetails>(cacheKey);
    if (cached !== null) {
      set({ currentEvent: cached, isLoading: false, error: null });
    } else {
      set({ isLoading: true, error: null });
    }

    try {
      const data = await queryCache.fetchJson<EventWithDetails>(
        cacheKey,
        `${API_URL}/events/${id}`,
        {
          ttlMs: 25_000,
          scope: 'events-detail',
          forceRefresh: cached !== null,
        }
      );
      set({ currentEvent: data, isLoading: false });
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      if (!cached) {
        set({ error: getErrorMessage(error), isLoading: false });
      }
    }
  },

  // Fetch events by city
  fetchEventsByCity: async (city: string) => {
    await get().fetchEvents({ city });
  },

  // Fetch featured events (city-isolated cache + cancellation + deduplication)
  fetchFeaturedEvents: async (city?: string) => {
    const cityKey = queryCache.normalizeCity(city);
    const params: Record<string, unknown> = {};
    if (cityKey !== 'all') params.city = cityKey;

    const cacheKey = `events:featured:${cityKey}`;
    const cached = queryCache.get<EventWithDetails[]>(cacheKey);
    if (cached !== null) {
      set({ featuredEvents: cached, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await queryCache.fetchJson<EventWithDetails[]>(
        cacheKey,
        `${API_URL}/events/featured`,
        {
          params,
          ttlMs: 40_000,
          scope: 'city:events-featured',
        }
      );
      set({ featuredEvents: Array.isArray(data) ? data : [], isLoading: false });
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Fetch past events (archive)
  fetchPastEvents: async (city?: string) => {
    const cityKey = queryCache.normalizeCity(city);
    const params: Record<string, unknown> = {};
    if (cityKey !== 'all') params.city = cityKey;

    const cacheKey = `events:past:${cityKey}`;
    const cached = queryCache.get<EventWithDetails[]>(cacheKey);
    if (cached !== null) {
      set({ events: cached, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await queryCache.fetchJson<EventWithDetails[]>(
        cacheKey,
        `${API_URL}/events/past`,
        {
          params,
          ttlMs: 45_000,
          scope: 'city:events-past',
        }
      );
      set({ events: Array.isArray(data) ? data : [], isLoading: false });
    } catch (error: unknown) {
      if (isAbortError(error)) return;
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

      queryCache.invalidatePrefix('events:');
      queryCache.invalidatePrefix('city-guide:');
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

      queryCache.invalidatePrefix('events:');
      queryCache.invalidatePrefix('city-guide:');
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

      queryCache.invalidatePrefix('events:');
      queryCache.invalidatePrefix('city-guide:');
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

  // No-op: backend GET /events/{id} already increments views via BackgroundTasks
  incrementViews: async (_id: string) => {
    return;
  },

  // Save event for user (Optimistic UI with duplicate-submission guard & rollback)
  saveEvent: async (eventId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    if (inFlightSaves.has(eventId)) return;
    inFlightSaves.add(eventId);

    const prevSaved = get().savedEvents;
    const candidate =
      get().events.find((e) => String(e.id) === String(eventId)) ||
      get().featuredEvents.find((e) => String(e.id) === String(eventId)) ||
      (get().currentEvent && String(get().currentEvent?.id) === String(eventId) ? get().currentEvent : null) ||
      ({ id: eventId, title: 'Saved Event' } as EventWithDetails);

    // Immediate optimistic update
    if (!prevSaved.some((e) => String(e.id) === String(eventId))) {
      const nextSaved = [...prevSaved, candidate];
      set({ savedEvents: nextSaved });
      queryCache.set('events:saved', nextSaved, 30_000);
    }

    try {
      await axios.post(`${API_URL}/events/${eventId}/save`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: unknown) {
      // Roll back optimistic state on failure
      set({ savedEvents: prevSaved });
      queryCache.set('events:saved', prevSaved, 30_000);
      throw new Error(getApiErrorDetail(error, 'Failed to save event'));
    } finally {
      inFlightSaves.delete(eventId);
    }
  },

  // Unsave event (Optimistic UI with duplicate-submission guard & rollback)
  unsaveEvent: async (eventId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    if (inFlightSaves.has(eventId)) return;
    inFlightSaves.add(eventId);

    const prevSaved = get().savedEvents;
    const nextSaved = prevSaved.filter((e) => String(e.id) !== String(eventId));
    // Immediate optimistic update
    set({
      savedEvents: nextSaved
    });
    queryCache.set('events:saved', nextSaved, 30_000);

    try {
      await axios.delete(`${API_URL}/events/${eventId}/save`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: unknown) {
      // Roll back optimistic state on failure
      set({ savedEvents: prevSaved });
      queryCache.set('events:saved', prevSaved, 30_000);
      throw new Error(getApiErrorDetail(error, 'Failed to unsave event'));
    } finally {
      inFlightSaves.delete(eventId);
    }
  },

  // Fetch organizer's own events
  fetchMyEvents: async (scope?: 'upcoming' | 'past') => {
    set({ isLoading: true, error: null });

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const url = scope
        ? `${API_URL}/events/me?scope=${scope}`
        : `${API_URL}/events/me`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({ events: response.data || [], isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Fetch user's saved events (deduplicated across mounted EventCard instances)
  fetchSavedEvents: async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        set({ savedEvents: [] });
        return;
      }

      const data = await queryCache.fetchJson<EventWithDetails[]>(
        'events:saved',
        `${API_URL}/events/saved`,
        {
          headers: { Authorization: `Bearer ${token}` },
          ttlMs: 30_000,
        }
      );

      set({ savedEvents: Array.isArray(data) ? data : [] });
    } catch (error: unknown) {
      if (isAbortError(error)) return;
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
