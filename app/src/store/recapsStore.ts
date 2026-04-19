import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function getApiErrorDetail(err: unknown, fallback = 'Unknown error'): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } } };
    return e.response?.data?.detail || fallback;
  }
  return fallback;
}


// Helper to get auth token
const getAuthToken = () =>
  localStorage.getItem('auth-token') ||
  localStorage.getItem('auth_token') ||
  localStorage.getItem('auth-token') || localStorage.getItem('token');

// ===========================================================================
// TYPES
// ===========================================================================

export interface Recap {
  id: number;
  title: string;
  description?: string;
  photos: string[];
  views_count: number;
  likes_count: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published';
  event_id?: number;
  organizer_id: number;
  organizer_name?: string;
  created_at: string;
  updated_at?: string;
  published_at?: string;
  event?: {
    title: string;
    city: string;
  };
  user_liked?: boolean;
}

export interface CreateRecapData {
  title: string;
  description?: string;
  photos: string[];
  event_id?: number;
}

export interface UpdateRecapData {
  title?: string;
  description?: string;
  photos?: string[];
  event_id?: number;
}

export interface RecapsState {
  recaps: Recap[];
  featuredRecaps: Recap[];
  myRecaps: Recap[];
  currentRecap: Recap | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRecaps: (params?: { status?: string; city?: string }) => Promise<void>;
  fetchFeaturedRecaps: (limit?: number) => Promise<void>;
  fetchRecapById: (id: number) => Promise<void>;
  fetchMyRecaps: () => Promise<void>;
  createRecap: (data: CreateRecapData) => Promise<Recap>;
  updateRecap: (id: number, data: UpdateRecapData) => Promise<void>;
  deleteRecap: (id: number) => Promise<void>;
  publishRecap: (id: number) => Promise<void>;
  likeRecap: (id: number) => Promise<{ liked: boolean; likes_count: number }>;
  
  // Admin actions
  fetchAllRecaps: (params?: { status?: string }) => Promise<void>;
  approveRecap: (id: number) => Promise<void>;
  rejectRecap: (id: number, reason?: string) => Promise<void>;
}

// ===========================================================================
// RECAPS STORE
// ===========================================================================

export const useRecapsStore = create<RecapsState>(// eslint-disable-next-line @typescript-eslint/no-unused-vars
(set, get) => ({
  recaps: [],
  featuredRecaps: [],
  myRecaps: [],
  currentRecap: null,
  isLoading: false,
  error: null,

  // Fetch published recaps
  fetchRecaps: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get(`${API_URL}/recaps`, { 
        params: { status: 'published', ...params }
      });
      set({ recaps: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ 
        error: getApiErrorDetail(error, 'Failed to fetch recaps'), 
        isLoading: false 
      });
    }
  },

  // Fetch featured recaps
  fetchFeaturedRecaps: async (limit = 6) => {
    try {
      const response = await axios.get(`${API_URL}/recaps/featured`, { 
        params: { limit }
      });
      set({ featuredRecaps: response.data });
    } catch (error: unknown) {
      console.error('Failed to fetch featured recaps:', error);
    }
  },

  // Fetch single recap
  fetchRecapById: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      const response = await axios.get(`${API_URL}/recaps/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      set({ currentRecap: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ 
        error: getApiErrorDetail(error, 'Failed to fetch recap'), 
        isLoading: false 
      });
    }
  },

  // Fetch my recaps (organizer)
  fetchMyRecaps: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      const response = await axios.get(`${API_URL}/recaps/my/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ myRecaps: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ 
        error: getApiErrorDetail(error, 'Failed to fetch your recaps'), 
        isLoading: false 
      });
    }
  },

  // Create recap
  createRecap: async (data: CreateRecapData) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      const response = await axios.post(`${API_URL}/recaps`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newRecap = response.data;
      set(state => ({ 
        myRecaps: [newRecap, ...state.myRecaps],
        isLoading: false 
      }));
      return newRecap;
    } catch (error: unknown) {
      set({ 
        error: getApiErrorDetail(error, 'Failed to create recap'), 
        isLoading: false 
      });
      throw error;
    }
  },

  // Update recap
  updateRecap: async (id: number, data: UpdateRecapData) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      const response = await axios.put(`${API_URL}/recaps/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedRecap = response.data;
      set(state => ({
        myRecaps: state.myRecaps.map(r => r.id === id ? updatedRecap : r),
        currentRecap: state.currentRecap?.id === id ? updatedRecap : state.currentRecap,
        isLoading: false
      }));
    } catch (error: unknown) {
      set({ 
        error: getApiErrorDetail(error, 'Failed to update recap'), 
        isLoading: false 
      });
      throw error;
    }
  },

  // Delete recap
  deleteRecap: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      await axios.delete(`${API_URL}/recaps/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set(state => ({
        myRecaps: state.myRecaps.filter(r => r.id !== id),
        recaps: state.recaps.filter(r => r.id !== id),
        isLoading: false
      }));
    } catch (error: unknown) {
      set({ 
        error: getApiErrorDetail(error, 'Failed to delete recap'), 
        isLoading: false 
      });
      throw error;
    }
  },

  // Publish recap
  publishRecap: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      await axios.post(`${API_URL}/recaps/${id}/publish`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set(state => ({
        myRecaps: state.myRecaps.map(r => 
          r.id === id ? { ...r, status: 'pending' as const } : r
        ),
        isLoading: false
      }));
    } catch (error: unknown) {
      set({ 
        error: getApiErrorDetail(error, 'Failed to publish recap'), 
        isLoading: false 
      });
      throw error;
    }
  },

  // Like/unlike recap
  likeRecap: async (id: number) => {
    try {
      const token = getAuthToken();
      const response = await axios.post(`${API_URL}/recaps/${id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { liked, likes_count } = response.data;
      
      set(state => ({
        recaps: state.recaps.map(r => 
          r.id === id ? { ...r, likes_count, user_liked: liked } : r
        ),
        featuredRecaps: state.featuredRecaps.map(r => 
          r.id === id ? { ...r, likes_count, user_liked: liked } : r
        ),
        currentRecap: state.currentRecap?.id === id 
          ? { ...state.currentRecap, likes_count, user_liked: liked }
          : state.currentRecap
      }));
      
      return { liked, likes_count };
    } catch (error: unknown) {
      throw new Error(getApiErrorDetail(error, 'Failed to like recap'));
    }
  },

  // ===========================================================================
  // ADMIN ACTIONS
  // ===========================================================================

  // Fetch all recaps (admin)
  fetchAllRecaps: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      const response = await axios.get(`${API_URL}/recaps/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      set({ recaps: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ 
        error: getApiErrorDetail(error, 'Failed to fetch recaps'), 
        isLoading: false 
      });
    }
  },

  // Approve recap (admin)
  approveRecap: async (id: number) => {
    try {
      const token = getAuthToken();
      await axios.post(`${API_URL}/recaps/admin/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set(state => ({
        recaps: state.recaps.map(r => 
          r.id === id ? { ...r, status: 'published' as const } : r
        )
      }));
    } catch (error: unknown) {
      throw new Error(getApiErrorDetail(error, 'Failed to approve recap'));
    }
  },

  // Reject recap (admin)
  rejectRecap: async (id: number, reason?: string) => {
    try {
      const token = getAuthToken();
      await axios.post(`${API_URL}/recaps/admin/${id}/reject`, { reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set(state => ({
        recaps: state.recaps.map(r => 
          r.id === id ? { ...r, status: 'rejected' as const } : r
        )
      }));
    } catch (error: unknown) {
      throw new Error(getApiErrorDetail(error, 'Failed to reject recap'));
    }
  }
}));
