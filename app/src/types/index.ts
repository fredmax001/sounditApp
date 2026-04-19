// ============================================
// SOUND IT - TYPE DEFINITIONS
// Aligned with Store Interfaces
// ============================================

// Re-export types from stores for component use
import type {
  Profile,
  AuthState
} from '@/store/authStore';

import type {
  Event,
  EventWithDetails,
  TicketTier,
  DJ,
  EventState,
  EventFilters,
  CreateEventData
} from '@/store/eventStore';

export type {
  Profile,
  AuthState,
  Event,
  EventWithDetails,
  TicketTier,
  DJ,
  EventState,
  EventFilters,
  CreateEventData
};

// ============================================
// LEGACY USER TYPE (for backward compatibility)
// Maps to Profile from authStore
// ============================================
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'artist' | 'organizer' | 'admin' | 'dj' | 'vendor';
  city?: string;
  createdAt: string;
  verification_badge?: boolean;
  // Extended properties for component compatibility
  favorites?: string[];
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

// ============================================
// CITY TYPE
// ============================================
export interface City {
  id: string;
  name: string;
  nameCN: string;
  image: string;
  description: string;
  venues: string[];
  neighborhoods: string[];
}

// ============================================
// LEGACY EVENT TYPE (backward compatibility)
// Maps to Event from eventStore with additional UI properties
// ============================================
export interface LegacyEvent {
  id: string;
  title: string;
  description: string;
  image: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  price: number;
  currency: string;
  category: string;
  city?: string;
  artistId?: string;
  artist?: Artist;
  ticketsAvailable: number;
  ticketsTotal: number;
  status: 'upcoming' | 'ongoing' | 'ended';
  featured: boolean;
  // UI-specific properties
  isFeatured?: boolean;
  isSoldOut?: boolean;
  sold?: number;
  tags?: string[];
  artists?: Artist[];
  gallery?: string[];
  ageRestriction?: string;
  dressCode?: string;
}

// ============================================
// ARTIST TYPE
// ============================================
export interface Artist {
  id: string;
  name: string;
  bio: string;
  image: string;
  genre: string;
  followers: number;
  events: LegacyEvent[];
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    soundcloud?: string;
    hearthis?: string;
  };
  mixes?: Mix[];
}

// ============================================
// MIX TYPE
// ============================================
export interface Mix {
  title: string;
  url: string;
  duration: string;
}

// ============================================
// TICKET TYPE
// ============================================
export interface Ticket {
  id: string;
  eventId: string;
  event: LegacyEvent;
  userId: string;
  quantity: number;
  totalPrice: number;
  status: 'active' | 'used' | 'cancelled' | 'pending' | 'completed' | 'refunded';
  qrCode: string;
  purchasedAt: string;
  // Extended properties for scanner and UI
  eventTitle?: string;
  checkedInAt?: string;
}

// ============================================
// CART ITEM TYPE
// ============================================
export interface CartItem {
  eventId: string;
  event: LegacyEvent;
  quantity: number;
}

// ============================================
// CATEGORY TYPE
// ============================================
export interface Category {
  id: string;
  name: string;
  icon: string;
}

// ============================================
// FOOD SPOT TYPE
// ============================================
export interface FoodSpot {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string;
  description: string;
  image: string;
}

// ============================================
// FEATURED MIX TYPE
// ============================================
export interface FeaturedMix {
  id: string;
  title: string;
  artist: string;
  duration: string;
  cover: string;
  plays?: string;
  embedUrl: string;
}

// ============================================
// ADMIN TYPES
// ============================================
export interface VerificationRequest {
  id: string;
  name?: string;
  user_id: string;
  type: 'organizer' | 'dj' | 'vendor';
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  documents?: string[];
  notes?: string;
  // Extended properties
  display_name?: string;
  organization_name?: string;
  stage_name?: string;
}

export interface Payout {
  id: string;
  targetId: string;
  targetName?: string;
  targetType?: 'organizer' | 'dj';
  eventId?: string;
  eventName?: string;
  amount: number;
  commission?: number;
  city?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'processing' | 'released';
  requestedAt: string;
}

export interface AdminState {
  stats: AdminStats;
  recentActivity: Activity[];
  systemHealth: SystemHealth;
  escrowBalance: number;
  releasedTotal: number;
  verificationRequests: VerificationRequest[];
  systemFlags: SystemFlags;
  frozenUserIds: string[];
  featuredEventIds: string[];
  disabledEventIds: string[];
  commissionRates: CommissionRates;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDashboardStats: () => Promise<void>;
  fetchRecentActivity: () => Promise<void>;
  freezeUser: (userId: string) => Promise<void>;
  unfreezeUser: (userId: string) => Promise<void>;
  toggleEventVisibility: (eventId: string) => Promise<void>;
  updateCommissionRate: (type: string, rate: number) => Promise<void>;
  toggleMaintenance: (enabled: boolean) => Promise<void>;
  releasePayout: (payoutId: string, amount: number) => Promise<void>;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalEvents: number;
  upcomingEvents: number;
  totalRevenue: number;
  monthlyGrowth: number;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  user: string;
  time: string;
}

export interface SystemHealth {
  database: 'healthy' | 'warning' | 'error';
  api: 'healthy' | 'warning' | 'error';
  storage: 'healthy' | 'warning' | 'error';
}

export interface SystemFlags {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  paymentsEnabled: boolean;
}

export interface CommissionRates {
  standard: number;
  featured: number;
  premium: number;
}

// ============================================
// PAYMENT TYPES
// ============================================
export interface PaymentState {
  clientSecret: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  createPayment: (amount: number, currency: string, metadata: Record<string, unknown>) => Promise<string>;
  confirmPayment: (paymentIntentId: string) => Promise<void>;
}

// ============================================
// HELPER FUNCTIONS FOR TYPE CONVERSION
// ============================================

// Convert EventWithDetails to LegacyEvent for component compatibility
export function toLegacyEvent(event: EventWithDetails): LegacyEvent {
  const ticketTier = event.ticket_tiers?.[0];

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    image: event.flyer_image,
    date: event.start_date,
    time: new Date(event.start_date).toLocaleTimeString(),
    venue: event.venue?.name || 'TBA',
    address: event.venue?.address || event.address || 'TBA',
    price: ticketTier?.price || 0,
    currency: ticketTier?.currency || 'CNY',
    category: 'Music',
    city: event.city,
    ticketsAvailable: (event.capacity || 0) - event.tickets_sold,
    ticketsTotal: event.capacity || 0,
    status: event.status === 'live' ? 'ongoing' :
      event.status === 'completed' ? 'ended' : 'upcoming',
    featured: event.is_featured,
    isFeatured: event.is_featured,
    isSoldOut: event.tickets_sold >= (event.capacity || 0),
    sold: event.tickets_sold,
    tags: [],
    gallery: event.gallery_images || [],
    artists: (event.djs || event.artist_djs)?.map((dj: { id: string; stage_name?: string; name?: string; avatar_url?: string; genres?: string[] }) => ({
      id: dj.id,
      name: dj.stage_name || dj.name,
      bio: '',
      image: dj.avatar_url || '',
      genre: dj.genres?.[0] || '',
      followers: 0,
      events: [],
    })) || [],
  };
}

// Convert Profile to User for component compatibility
export function toUser(profile: Profile): User {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
    avatar: profile.avatar_url || undefined,
    role: profile.role as User['role'],
    city: profile.city?.name || undefined,
    createdAt: profile.created_at,
    display_name: profile.display_name,
    first_name: profile.first_name,
    last_name: profile.last_name,
  };
}

