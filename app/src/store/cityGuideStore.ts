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


export interface Club {
    id: string;
    name: string;
    name_cn?: string;
    city: string;
    address: string;
    description?: string;
    music_genres: string[];
    is_afrobeat_friendly: boolean;
    cover_image?: string;
    logo_url?: string;
    phone?: string;
    website?: string;
    instagram?: string;
    opening_hours?: Record<string, string>;
    is_verified: boolean;
    rating?: number;
    reviews_count?: number;
    created_at?: string;
}

export interface FoodSpot {
    id: string;
    name: string;
    name_cn?: string;
    city: string;
    address: string;
    description?: string;
    cuisine_type?: string;
    cuisine_types?: string[];
    price_range?: string;
    cover_image?: string;
    logo_url?: string;
    phone?: string;
    website?: string;
    instagram?: string;
    opening_hours?: Record<string, string>;
    is_verified: boolean;
    rating?: number;
    reviews_count?: number;
    delivery_available?: boolean;
    takeout_available?: boolean;
    created_at?: string;
}

export interface Review {
    id: string;
    venue_id: string;
    user_id: string;
    user_name?: string;
    user_avatar?: string;
    rating: number;
    comment?: string;
    created_at: string;
}

export interface GuideItem {
    id: number;
    user_id?: number;
    type: 'event' | 'venue' | 'food' | 'artist' | 'vendor' | 'business' | 'organizer';
    name: string;
    lat: number;
    lng: number;
    image?: string;
    address?: string;
    description?: string;
    meta: Record<string, unknown>;
}

interface CityGuideState {
    clubs: Club[];
    foodSpots: FoodSpot[];
    currentVenue: Club | FoodSpot | null;
    reviews: Review[];
    isLoading: boolean;
    error: string | null;

    // New map/guide state
    guideItems: GuideItem[];
    selectedItem: GuideItem | null;
    mapCenter: { lat: number; lng: number };

    fetchClubs: (city?: string, filters?: Record<string, unknown>) => Promise<void>;
    fetchFoodSpots: (city?: string, filters?: Record<string, unknown>) => Promise<void>;
    fetchClubById: (id: string) => Promise<void>;
    fetchFoodSpotById: (id: string) => Promise<void>;
    fetchVenueReviews: (venueId: string, venueType: 'club' | 'foodspot') => Promise<void>;
    submitReview: (token: string, venueId: string, venueType: 'club' | 'foodspot', rating: number, comment?: string) => Promise<void>;
    searchVenues: (query: string, city?: string) => Promise<void>;
    fetchAfrobeatFriendly: (city?: string) => Promise<void>;

    // New actions
    fetchCityGuide: (city: string) => Promise<void>;
    setSelectedItem: (item: GuideItem | null) => void;
    setMapCenter: (lat: number, lng: number) => void;
}

export const useCityGuideStore = create<CityGuideState>((set, get) => ({
    clubs: [],
    foodSpots: [],
    currentVenue: null,
    reviews: [],
    isLoading: false,
    error: null,

    guideItems: [],
    selectedItem: null,
    mapCenter: { lat: 31.2304, lng: 121.4737 },

    fetchClubs: async (city?: string, filters?: Record<string, unknown>) => {
        set({ isLoading: true, error: null });
        try {
            const params: Record<string, unknown> = { ...filters };
            if (city && city !== 'all') {
                params.city = city;
            }

            const response = await axios.get(`${API_URL}/clubs`, { params });
            set({ clubs: response.data || [], isLoading: false });
        } catch (error: unknown) {
            console.error('Error fetching clubs:', error);
            set({ error: getErrorMessage(error), isLoading: false });
        }
    },

    fetchFoodSpots: async (city?: string, filters?: Record<string, unknown>) => {
        set({ isLoading: true, error: null });
        try {
            const params: Record<string, unknown> = { ...filters };
            if (city && city !== 'all') {
                params.city = city;
            }

            const response = await axios.get(`${API_URL}/foodspots`, { params });
            set({ foodSpots: response.data || [], isLoading: false });
        } catch (error: unknown) {
            console.error('Error fetching food spots:', error);
            set({ error: getErrorMessage(error), isLoading: false });
        }
    },

    fetchClubById: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/clubs/${id}`);
            set({ currentVenue: response.data, isLoading: false });
        } catch (error: unknown) {
            console.error('Error fetching club:', error);
            set({ error: getErrorMessage(error), isLoading: false });
        }
    },

    fetchFoodSpotById: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/foodspots/${id}`);
            set({ currentVenue: response.data, isLoading: false });
        } catch (error: unknown) {
            console.error('Error fetching food spot:', error);
            set({ error: getErrorMessage(error), isLoading: false });
        }
    },

    fetchVenueReviews: async (venueId: string, venueType: 'club' | 'foodspot') => {
        set({ isLoading: true, error: null });
        try {
            const endpoint = venueType === 'club' 
                ? `${API_URL}/clubs/${venueId}/reviews`
                : `${API_URL}/foodspots/${venueId}/reviews`;
            
            const response = await axios.get(endpoint);
            set({ reviews: response.data || [], isLoading: false });
        } catch (error: unknown) {
            console.error('Error fetching reviews:', error);
            set({ error: getErrorMessage(error), isLoading: false });
        }
    },

    submitReview: async (token: string, venueId: string, venueType: 'club' | 'foodspot', rating: number, comment?: string) => {
        set({ isLoading: true, error: null });
        try {
            const endpoint = venueType === 'club'
                ? `${API_URL}/clubs/${venueId}/reviews`
                : `${API_URL}/foodspots/${venueId}/reviews`;

            await axios.post(endpoint, { rating, comment }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh reviews
            await get().fetchVenueReviews(venueId, venueType);
            set({ isLoading: false });
        } catch (error: unknown) {
            console.error('Error submitting review:', error);
            set({ error: getErrorMessage(error), isLoading: false });
        }
    },

    searchVenues: async (query: string, city?: string) => {
        set({ isLoading: true, error: null });
        try {
            const params: Record<string, unknown> = { q: query };
            if (city && city !== 'all') {
                params.city = city;
            }

            const [clubsResponse, foodSpotsResponse] = await Promise.all([
                axios.get(`${API_URL}/clubs/search`, { params }),
                axios.get(`${API_URL}/foodspots/search`, { params }),
            ]);

            set({
                clubs: clubsResponse.data || [],
                foodSpots: foodSpotsResponse.data || [],
                isLoading: false,
            });
        } catch (error: unknown) {
            console.error('Error searching venues:', error);
            set({ error: getErrorMessage(error), isLoading: false });
        }
    },

    fetchAfrobeatFriendly: async (city?: string) => {
        set({ isLoading: true, error: null });
        try {
            const params: Record<string, unknown> = { afrobeat_friendly: true };
            if (city && city !== 'all') {
                params.city = city;
            }

            const response = await axios.get(`${API_URL}/clubs`, { params });
            set({ clubs: response.data || [], isLoading: false });
        } catch (error: unknown) {
            console.error('Error fetching afrobeat friendly clubs:', error);
            set({ error: getErrorMessage(error), isLoading: false });
        }
    },

    fetchCityGuide: async (city: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/cities/${encodeURIComponent(city)}/guide`);
            const data = response.data;
            const items: GuideItem[] = [];

            (data.events || []).forEach((evt: Record<string, unknown>) => {
                items.push({
                    id: evt.id as number,
                    type: 'event',
                    name: evt.title as string,
                    lat: evt.latitude as number,
                    lng: evt.longitude as number,
                    image: evt.flyer_image as string | undefined,
                    address: evt.address as string | undefined,
                    description: evt.venue_name as string | undefined,
                    meta: {
                        start_date: evt.start_date,
                        venue_name: evt.venue_name,
                    },
                });
            });

            (data.venues || []).forEach((ven: Record<string, unknown>) => {
                items.push({
                    id: ven.id as number,
                    type: 'venue',
                    name: ven.name as string,
                    lat: ven.latitude as number,
                    lng: ven.longitude as number,
                    image: ven.cover_image as string | undefined,
                    address: ven.address as string | undefined,
                    description: ven.category as string | undefined,
                    meta: {
                        category: ven.category,
                    },
                });
            });

            (data.foodSpots || []).forEach((food: Record<string, unknown>) => {
                items.push({
                    id: food.id as number,
                    type: 'food',
                    name: food.name as string,
                    lat: food.latitude as number,
                    lng: food.longitude as number,
                    image: food.cover_image as string | undefined,
                    address: food.address as string | undefined,
                    description: food.cuisine_type as string | undefined,
                    meta: {
                        cuisine_type: food.cuisine_type,
                    },
                });
            });

            (data.artists || []).forEach((artist: Record<string, unknown>) => {
                items.push({
                    id: artist.id as number,
                    user_id: artist.user_id as number | undefined,
                    type: 'artist',
                    name: artist.stage_name as string,
                    lat: artist.latitude as number,
                    lng: artist.longitude as number,
                    image: artist.avatar_url as string | undefined,
                    address: undefined,
                    description: artist.genre as string | undefined,
                    meta: {
                        followers_count: artist.followers_count,
                        events_count: artist.events_count,
                        is_verified: artist.is_verified,
                    },
                });
            });

            (data.vendors || []).forEach((vendor: Record<string, unknown>) => {
                items.push({
                    id: vendor.id as number,
                    user_id: vendor.user_id as number | undefined,
                    type: 'vendor',
                    name: vendor.business_name as string,
                    lat: vendor.latitude as number,
                    lng: vendor.longitude as number,
                    image: vendor.logo_url as string | undefined,
                    address: vendor.address as string | undefined,
                    description: vendor.vendor_type as string | undefined,
                    meta: {
                        rating: vendor.rating,
                        reviews_count: vendor.reviews_count,
                        is_verified: vendor.is_verified,
                    },
                });
            });

            (data.businesses || []).forEach((biz: Record<string, unknown>) => {
                items.push({
                    id: biz.id as number,
                    user_id: biz.user_id as number | undefined,
                    type: 'business',
                    name: biz.business_name as string,
                    lat: biz.latitude as number,
                    lng: biz.longitude as number,
                    image: biz.avatar_url as string | undefined,
                    address: biz.address as string | undefined,
                    description: biz.description as string | undefined,
                    meta: {
                        events_count: biz.events_count,
                        is_verified: biz.is_verified,
                    },
                });
            });

            (data.organizers || []).forEach((org: Record<string, unknown>) => {
                items.push({
                    id: org.id as number,
                    user_id: org.user_id as number | undefined,
                    type: 'organizer',
                    name: org.organization_name as string,
                    lat: org.latitude as number,
                    lng: org.longitude as number,
                    image: org.avatar_url as string | undefined,
                    address: org.address as string | undefined,
                    description: org.description as string | undefined,
                    meta: {
                        events_count: org.events_count,
                        is_verified: org.is_verified,
                    },
                });
            });

            // Compute map center from items or default to Shanghai
            let center = { lat: 31.2304, lng: 121.4737 };
            if (items.length > 0) {
                const lats = items.map(i => i.lat);
                const lngs = items.map(i => i.lng);
                center = {
                    lat: lats.reduce((a, b) => a + b, 0) / lats.length,
                    lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
                };
            }

            set({ guideItems: items, mapCenter: center, isLoading: false });
        } catch (error: unknown) {
            console.error('Error fetching city guide:', error);
            set({ error: getErrorMessage(error), isLoading: false });
        }
    },

    setSelectedItem: (item: GuideItem | null) => {
        set({ selectedItem: item });
    },

    setMapCenter: (lat: number, lng: number) => {
        set({ mapCenter: { lat, lng } });
    },
}));

export default useCityGuideStore;
