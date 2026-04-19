import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Local type definitions (no Supabase dependency)
interface User {
  id: string;
  email?: string | null;
  phone?: string | null;
  aud?: string;
  role?: string;
  confirmed_at?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  identities?: unknown[];
  updated_at?: string;
  verification_badge?: boolean;
}

interface Session {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: User;
}

// ============================================
// NETWORK UTILITIES
// ============================================
async function fetchWithErrorHandling(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Check for network errors
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorData;
      try {
        if (contentType?.includes('application/json')) {
          errorData = await response.json();
        } else {
          errorData = { detail: await response.text() };
        }
      } catch {
        errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
      }

      const errorMessage = errorData.detail ||
        errorData.message ||
        `HTTP ${response.status}: ${response.statusText}`;

      const error = new Error(errorMessage);
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    return response;
  } catch (error: unknown) {
    // Handle network errors
    if (error instanceof TypeError) {
      if ((error as TypeError).message.includes('Failed to fetch')) {
        throw new Error(
          'Network error: Unable to reach server. Please check if the backend is running at ' +
          (import.meta.env.VITE_API_URL || 'http://localhost:8000') +
          ' and that CORS is enabled.'
        );
      }
      throw new Error(`Network error: ${(error as TypeError).message}`);
    }
    throw error;
  }
}

// ============================================
// TYPES
// ============================================
export type UserRole = 'user' | 'business' | 'artist' | 'admin' | 'super_admin' | 'moderator' | 'vendor';
export type BusinessType = 'club' | 'bar' | 'lounge' | 'restaurant' | 'organizer' | 'promoter' | 'venue' | 'other';
export type ArtistType = 'Artist' | 'DJ' | 'MC' | 'dj' | 'singer' | 'rapper' | 'band' | 'producer' | 'instrumentalist' | 'other';

export interface City {
  id: string;
  name: string;
  name_cn?: string;
  latitude?: number;
  longitude?: number;
}

export interface Profile {
  id: string;
  email: string;
  phone: string | null;
  role: 'user' | 'organizer' | 'admin' | 'super_admin' | 'dj' | 'vendor';
  role_type: UserRole;
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  background_url?: string | null;
  bio: string | null;
  city_id: string | null;
  city: City | null;
  country: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_id_verified: boolean;
  is_verified: boolean;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verification_badge?: boolean;
  followers_count: number;
  following_count: number;
  created_at: string;
  last_login: string | null;
  instagram?: string;
  twitter?: string;
  wechat_id?: string;
  website?: string;
}

export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_type: BusinessType;
  business_email: string;
  business_phone: string;
  city_id: string;
  city: City | null;
  address: string;
  description: string;
  website?: string;
  services: string[];
  logo_url: string;
  banner_url: string;
  gallery_images: string[];
  is_verified: boolean;
  verification_status: string;
  total_events: number;
  total_sales: number;
  rating: number;
}

export interface ArtistProfile {
  id: string;
  user_id: string;
  stage_name: string;
  real_name: string;
  artist_type: ArtistType;
  genres: string[];
  bio: string;
  profile_image_url: string;
  banner_url: string;
  gallery_images: string[];
  soundcloud_url: string;
  spotify_url: string;
  instagram: string;
  is_available_for_booking: boolean;
  booking_fee_range: string;
  is_verified: boolean;
  verification_status: string;
  follower_count: number;
  rating: number;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  businessProfile: BusinessProfile | null;
  artistProfile: ArtistProfile | null;
  session: Session | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedCity: string | null;
  cities: City[];
  initialize: () => Promise<void>;
  fetchCities: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<Profile | undefined>;
  registerWithEmail: (data: RegisterData) => Promise<void>;
  sendOTP: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOTP: (phone: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  uploadBanner: (file: File) => Promise<string>;
  uploadGalleryImage: (file: File) => Promise<string>;
  setSelectedCity: (city: string) => void;
  detectCityByLocation: () => Promise<void>;
  refreshSession: () => Promise<void>;
  createBusinessProfile: (data: BusinessProfileData) => Promise<void>;
  updateBusinessProfile: (data: Partial<BusinessProfile>) => Promise<void>;
  createArtistProfile: (data: ArtistProfileData) => Promise<void>;
  updateArtistProfile: (data: Partial<ArtistProfile>) => Promise<void>;
  fetchBusinessProfile: () => Promise<void>;
  fetchArtistProfile: () => Promise<void>;
  isAdmin: () => boolean;
  setProfile: (profile: Profile) => void;
}

interface RegisterData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  city_id?: string;
  phone?: string;
  role_type?: UserRole;
}

interface BusinessProfileData {
  business_name: string;
  business_type: BusinessType;
  city_id: string;
  description?: string;
  services?: string[];
  address?: string;
  business_email?: string;
  business_phone?: string;
}

interface ArtistProfileData {
  stage_name: string;
  artist_type: ArtistType;
  genres: string[];
  bio?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ============================================
// AUTH STORE - PRODUCTION VERSION
// ============================================
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      businessProfile: null,
      artistProfile: null,
      session: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      selectedCity: null,
      cities: [],

      // Initialize auth state
      initialize: async () => {
        try {
          // Load cities
          await get().fetchCities();
          // Auto-detect city from location (only if not already set)
          get().detectCityByLocation();

          // Check for stored token first
          const token = localStorage.getItem('auth-token');

          if (token) {
            // Validate token and get user profile
            try {
              const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                const backendUser = await response.json();

                // Map Role - handle both uppercase (enum) and lowercase formats
                // Must match loginWithEmail logic exactly
                let roleType: UserRole = 'user';
                let role: 'user' | 'organizer' | 'admin' | 'dj' | 'vendor' = 'user';

                const backendRoleRaw = backendUser.role || '';
                const backendRole = backendRoleRaw.toLowerCase ? backendRoleRaw.toLowerCase() : String(backendRoleRaw).toLowerCase();

                // BUSINESS and ORGANIZER roles are treated the same (unified as Business)
                if (backendRole === 'business' || backendRole === 'organizer') {
                  roleType = 'business';
                  role = 'organizer';
                } else if (backendRole === 'artist' || backendRole === 'dj') {
                  roleType = 'artist';
                  role = 'dj';
                } else if (backendRole === 'super_admin') {
                  roleType = 'super_admin';
                  role = 'admin';
                } else if (backendRole === 'admin') {
                  roleType = 'admin';
                  role = 'admin';
                } else if (backendRole === 'vendor') {
                  roleType = 'vendor';
                  role = 'vendor';
                }

                const city = get().cities.find(c =>
                  c.id.toLowerCase() === (backendUser.preferred_city || '').toLowerCase()
                ) || null;

                const profile: Profile = {
                  id: String(backendUser.id),
                  email: backendUser.email || '',
                  phone: backendUser.phone,
                  role: role,
                  role_type: roleType as UserRole,
                  status: 'active',
                  first_name: backendUser.first_name,
                  last_name: backendUser.last_name,
                  display_name: `${backendUser.first_name || ''} ${backendUser.last_name || ''}`.trim(),
                  username: backendUser.username || null,
                  avatar_url: backendUser.avatar_url,
                  banner_url: backendUser.background_url,
                  bio: backendUser.bio,
                  city_id: backendUser.preferred_city,
                  city: city,
                  country: 'China',
                  is_email_verified: backendUser.is_verified,
                  is_phone_verified: !!backendUser.phone,
                  is_id_verified: backendUser.is_verified,
                  is_verified: backendUser.is_verified,
                  verification_status: (backendUser.is_verified ? 'verified' : 'unverified') as Profile['verification_status'],
                  followers_count: 0,
                  following_count: 0,
                  created_at: backendUser.created_at,
                  last_login: backendUser.last_login,
                  instagram: backendUser.instagram,
                  twitter: backendUser.twitter,
                  wechat_id: backendUser.wechat_id,
                };

                const session: Session = {
                  access_token: token,
                  token_type: 'bearer',
                  expires_in: 3600 * 24,
                  refresh_token: '',
                  user: { id: String(backendUser.id), email: backendUser.email, phone: backendUser.phone } as User,
                };

                set({
                  user: { id: String(backendUser.id), email: backendUser.email, phone: backendUser.phone } as User,
                  profile,
                  session,
                  isAuthenticated: true,
                  isLoading: false,
                  selectedCity: backendUser.preferred_city || null,
                });

                // Set user ID in cart store
                const { useCartStore } = await import('./cartStore');
                useCartStore.getState().setUserId(String(backendUser.id));

                // Fetch business/artist profiles if applicable
                if (roleType === 'business') {
                  await get().fetchBusinessProfile();
                } else if (roleType === 'artist') {
                  await get().fetchArtistProfile();
                }

                return;
              } else {
                // Token invalid, remove it
                localStorage.removeItem('auth-token');
              }
            } catch (error) {
              console.error('Token validation error:', error);
              localStorage.removeItem('auth-token');
            }
          }

          // No additional auth fallback — backend API is the single source of truth
        } catch (error) {
          console.error('Auth initialization error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      // Fetch cities from backend API
      fetchCities: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/cities`);
          if (response.ok) {
            const data = await response.json();
            set({ cities: data || [] });
          } else {
            set({ cities: [] });
          }
        } catch (error) {
          console.error('Error fetching cities:', error);
          set({ cities: [] });
        }
      },

      // Detect nearest city from browser geolocation
      detectCityByLocation: async () => {
        const { selectedCity } = get();
        // Only auto-detect if user hasn't manually selected a city
        if (selectedCity) return;
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const response = await fetch(
                `${API_BASE_URL}/cities/detect?lat=${latitude}&lng=${longitude}`
              );
              if (response.ok) {
                const data = await response.json();
                if (data.city?.id) {
                  get().setSelectedCity(data.city.id);
                }
              }
            } catch (error) {
              console.error('Error detecting city:', error);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
        );
      },

      // Email + Password Login
      loginWithEmail: async (email: string, password: string) => {
        set({ isLoading: true });

        try {
          const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          // Map Backend User response to Frontend state
          const backendUser = data.user;
          const accessToken = data.access_token;

          // Construct Supabase-like User object
          const user: User = {
            id: String(backendUser.id),
            aud: 'authenticated',
            role: 'authenticated',
            email: backendUser.email,
            phone: backendUser.phone,
            confirmed_at: backendUser.created_at,
            created_at: backendUser.created_at,
            last_sign_in_at: backendUser.last_login,
            app_metadata: { provider: 'email' },
            user_metadata: {},
            identities: [],
            updated_at: backendUser.updated_at || backendUser.created_at,
          };

          // Map Role - handle both uppercase (enum) and lowercase formats
          let roleType: UserRole = 'user';
          let role: 'user' | 'organizer' | 'admin' | 'dj' | 'vendor' = 'user';

          const backendRoleRaw = backendUser.role || '';
          const backendRole = backendRoleRaw.toLowerCase ? backendRoleRaw.toLowerCase() : String(backendRoleRaw).toLowerCase();

          // BUSINESS and ORGANIZER roles are treated the same (unified as Business)
          if (backendRole === 'business' || backendRole === 'organizer') {
            roleType = 'business';
            role = 'organizer'; // Keep 'organizer' for backend compatibility
          } else if (backendRole === 'artist' || backendRole === 'dj') {
            roleType = 'artist';
            role = 'dj';
          } else if (backendRole === 'super_admin') {
            roleType = 'super_admin';
            role = 'admin';
          } else if (backendRole === 'admin') {
            roleType = 'admin';
            role = 'admin';
          } else if (backendRole === 'vendor') {
            roleType = 'vendor';
            role = 'vendor';
          }

          const city = get().cities.find(c =>
            c.id.toLowerCase() === (backendUser.preferred_city || '').toLowerCase()
          ) || null;

          // Construct Profile object
          const profile: Profile = {
            id: String(backendUser.id),
            email: backendUser.email || '',
            phone: backendUser.phone,
            role: role,
            role_type: roleType,
            status: 'active',
            first_name: backendUser.first_name,
            last_name: backendUser.last_name,
            display_name: `${backendUser.first_name || ''} ${backendUser.last_name || ''}`.trim(),
            username: backendUser.username || null,
            avatar_url: backendUser.avatar_url,
            banner_url: null,
            bio: backendUser.bio,
            city_id: backendUser.preferred_city,
            city: city,
            country: 'China',
            is_email_verified: backendUser.is_verified,
            is_phone_verified: !!backendUser.phone,
            is_id_verified: backendUser.is_verified,
            is_verified: backendUser.is_verified,
            verification_status: backendUser.is_verified ? 'verified' : 'unverified',
            followers_count: 0,
            following_count: 0,
            created_at: backendUser.created_at,
            last_login: backendUser.last_login,
            instagram: backendUser.instagram,
            twitter: backendUser.twitter,
            wechat_id: backendUser.wechat_id,
          };

          // Basic emulation of session
          const session: Session = {
            access_token: accessToken,
            token_type: 'bearer',
            expires_in: 3600 * 24,
            refresh_token: '',
            user: user,
          };

          // Store token in localStorage for persistence
          localStorage.setItem('auth-token', accessToken);

          set({
            user: user,
            profile: profile,
            businessProfile: null,
            artistProfile: null,
            session: session,
            isAuthenticated: true,
            isLoading: false,
            selectedCity: backendUser.preferred_city || null,
          });

          // Set user ID in cart store
          const { useCartStore } = await import('./cartStore');
          useCartStore.getState().setUserId(user.id);

          // Fetch business/artist profiles if applicable
          if (roleType === 'business') {
            await get().fetchBusinessProfile();
          } else if (roleType === 'artist') {
            await get().fetchArtistProfile();
          }

          return profile;

        } catch (error: unknown) {
          console.error('Login error:', error);
          set({ isLoading: false });
          throw new Error((error as { message?: string }).message || 'Login failed');
        }
      },

      // Email Registration with Role - Using Backend API
      registerWithEmail: async (data: RegisterData) => {
        set({ isLoading: true });

        try {
          // Normalize role type
          const rawRoleType = data.role_type as string || 'user';
          const roleType = rawRoleType === 'artist_dj' ? 'artist' : rawRoleType as UserRole;

          const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: data.email,
              phone: data.phone,
              password: data.password,
              first_name: data.first_name,
              last_name: data.last_name,
              role: roleType,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Registration failed');
          }

          const authData = await response.json();

          if (authData.access_token) {
            // Store token and user data
            localStorage.setItem('auth-token', authData.access_token);

            const session = {
              access_token: authData.access_token,
              refresh_token: '',
              expires_in: 3600,
              token_type: 'bearer',
              user: authData.user,
            } as unknown as Session;

            set({
              user: authData.user,
              profile: authData.user,
              session,
              isAuthenticated: true,
              isLoading: false,
            });

            // Set user ID in cart store
            const { useCartStore } = await import('./cartStore');
            useCartStore.getState().setUserId(authData.user.id);
          } else {
            set({ isLoading: false });
          }
        } catch (error: unknown) {
          set({ isLoading: false });
          throw new Error((error as { message?: string }).message || 'Registration failed');
        }
      },

      // Send OTP via backend API (SMS or Email)
      sendOTP: async (identifier: string) => {
        set({ isLoading: true });
        try {
          // Determine if it's email or phone
          const isEmail = identifier.includes('@');

          const endpoint = isEmail ? `${API_BASE_URL}/otp/email/send` : `${API_BASE_URL}/otp/sms/send`;
          const body = isEmail
            ? JSON.stringify({ email: identifier, purpose: 'login' })
            : JSON.stringify({ phone: identifier, purpose: 'login' });

          const response = await fetchWithErrorHandling(endpoint, {
            method: 'POST',
            body: body,
          });

          const data = await response.json();

          return { success: true, message: data.message || 'OTP sent successfully' };
        } catch (error: unknown) {
          console.error('[Auth] OTP send error:', (error as { message?: string }).message);
          throw new Error((error as { message?: string }).message || 'Failed to send verification code');
        } finally {
          set({ isLoading: false });
        }
      },

      // Verify OTP via backend API
      verifyOTP: async (identifier: string, code: string) => {
        set({ isLoading: true });

        try {
          const response = await fetch(`${API_BASE_URL}/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, code }),
          });

          const data = await response.json();

          if (!data.success) {
            set({ isLoading: false });
            return false;
          }

          // If backend returned a token, fetch user profile and login
          if (data.token) {
            // Store token
            localStorage.setItem('auth-token', data.token);

            // Fetch user profile
            const profileResponse = await fetch(`${API_BASE_URL}/auth/me`, {
              headers: {
                'Authorization': `Bearer ${data.token}`,
              },
            });

            if (!profileResponse.ok) {
              set({ isLoading: false });
              return false;
            }

            const backendUser = await profileResponse.json();

            // Map Role - handle both uppercase (enum) and lowercase formats
            let roleType: UserRole = 'user';
            let role: 'user' | 'organizer' | 'admin' | 'dj' | 'vendor' = 'user';

            const backendRoleRaw = backendUser.role || '';
            const backendRole = backendRoleRaw.toLowerCase ? backendRoleRaw.toLowerCase() : String(backendRoleRaw).toLowerCase();

            // BUSINESS and ORGANIZER roles are treated the same (unified as Business)
            if (backendRole === 'business' || backendRole === 'organizer') {
              roleType = 'business';
              role = 'organizer';
            } else if (backendRole === 'artist' || backendRole === 'dj') {
              roleType = 'artist';
              role = 'dj';
            } else if (backendRole === 'super_admin') {
              roleType = 'super_admin';
              role = 'admin';
            } else if (backendRole === 'admin') {
              roleType = 'admin';
              role = 'admin';
            } else if (backendRole === 'vendor') {
              roleType = 'vendor';
              role = 'vendor';
            }

            const city = get().cities.find(c =>
              c.id.toLowerCase() === (backendUser.preferred_city || '').toLowerCase()
            ) || null;

            const profile: Profile = {
              id: String(backendUser.id),
              email: backendUser.email || '',
              phone: backendUser.phone,
              role: role,
              role_type: roleType as UserRole,
              status: 'active',
              first_name: backendUser.first_name,
              last_name: backendUser.last_name,
              display_name: `${backendUser.first_name || ''} ${backendUser.last_name || ''}`.trim(),
              username: backendUser.username || null,
              avatar_url: backendUser.avatar_url,
              banner_url: backendUser.background_url,
              bio: backendUser.bio,
              city_id: backendUser.preferred_city,
              city: city,
              country: 'China',
              is_email_verified: backendUser.is_verified,
              is_phone_verified: !!backendUser.phone,
              is_id_verified: backendUser.is_verified,
              is_verified: backendUser.is_verified,
              verification_status: backendUser.is_verified ? 'verified' : 'unverified',
              followers_count: 0,
              following_count: 0,
              created_at: backendUser.created_at,
              last_login: backendUser.last_login,
              instagram: backendUser.instagram,
              twitter: backendUser.twitter,
              wechat_id: backendUser.wechat_id,
            };

            const session: Session = {
              access_token: data.token,
              token_type: 'bearer',
              expires_in: 3600 * 24,
              refresh_token: '',
              user: { id: String(backendUser.id), email: backendUser.email, phone: backendUser.phone } as User,
            };

            set({
              user: { id: String(backendUser.id), email: backendUser.email, phone: backendUser.phone } as User,
              profile: profile,
              session: session,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              selectedCity: backendUser.preferred_city || null,
            });
          } else {
            set({ isLoading: false });
            return false;
          }

          return true;
        } catch (error: unknown) {
          console.error('[Auth] OTP verification error:', (error as { message?: string }).message);
          set({ isLoading: false });
          throw error;
        }
      },

      // Logout
      logout: async () => {
        // Import cart store to clear cart
        const { useCartStore } = await import('./cartStore');
        const cartStore = useCartStore.getState();
        cartStore.clearCart();

        localStorage.removeItem('auth-token');

        set({
          user: null,
          profile: null,
          businessProfile: null,
          artistProfile: null,
          session: null,
          token: null,
          isAuthenticated: false,
        });
        localStorage.removeItem('auth-token');
        localStorage.removeItem('token');
      },

      // Update Profile
      updateProfile: async (data: Partial<Profile>) => {
        const { user, profile, session } = get();
        if (!user || !profile || !session?.access_token) throw new Error('Not authenticated');

        try {
          // Update via backend API
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update profile');
          }

          // Fetch fresh profile to ensure state matches backend
          const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });
          if (!meResponse.ok) throw new Error('Failed to fetch updated profile');
          const backendUser = await meResponse.json();

          const city = get().cities.find(c =>
            c.id.toLowerCase() === (backendUser.preferred_city || '').toLowerCase()
          ) || null;

          const updatedProfile: Profile = {
            ...profile,
            first_name: backendUser.first_name,
            last_name: backendUser.last_name,
            display_name: `${backendUser.first_name || ''} ${backendUser.last_name || ''}`.trim(),
            username: backendUser.username || null,
            bio: backendUser.bio,
            avatar_url: backendUser.avatar_url,
            banner_url: backendUser.background_url,
            phone: backendUser.phone,
            city_id: backendUser.preferred_city,
            city: city,
            instagram: backendUser.instagram,
            twitter: backendUser.twitter,
            wechat_id: backendUser.wechat_id,
            is_verified: backendUser.is_verified,
            verification_status: backendUser.is_verified ? 'verified' : 'unverified',
          };

          set({ profile: updatedProfile, selectedCity: backendUser.preferred_city || null });
        } catch (error: unknown) {
          console.error('Profile update error:', error);
          throw new Error((error as { message?: string }).message || 'Failed to update profile');
        }
      },

      // Upload Avatar
      uploadAvatar: async (file: File): Promise<string> => {
        const { session } = get();
        if (!session?.access_token) throw new Error('Not authenticated');

        // Validate file
        if (!file.type.startsWith('image/')) {
          throw new Error('Please select a valid image file');
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB
          throw new Error('Image size must be less than 5MB');
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch(`${API_BASE_URL}/media/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorData;
            try {
              if (contentType?.includes('application/json')) {
                errorData = await response.json();
              } else {
                errorData = { detail: await response.text() };
              }
            } catch {
              errorData = { detail: `Upload failed: HTTP ${response.status}` };
            }
            throw new Error(errorData.detail || 'Failed to upload avatar');
          }

          const data = await response.json();
          const avatarUrl = data.url;

          // Update user profile with new avatar URL
          const updateResponse = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ avatar_url: avatarUrl }),
          });

          if (!updateResponse.ok) {
            const error = await updateResponse.json();
            throw new Error(error.detail || 'Failed to update profile with avatar');
          }

          // Update local profile state
          const { profile } = get();
          if (profile) {
            set({ profile: { ...profile, avatar_url: avatarUrl } });
          }

          return avatarUrl;
        } catch (error: unknown) {
          if (error instanceof TypeError && (error as TypeError).message.includes('Failed to fetch')) {
            throw new Error(
              'Network error: Unable to connect to server. Please check if the backend is running at ' +
              API_BASE_URL
            );
          }
          throw error;
        }
      },

      // Upload Banner
      uploadBanner: async (file: File): Promise<string> => {
        const { session } = get();
        if (!session?.access_token) throw new Error('Not authenticated');

        // Validate file
        if (!file.type.startsWith('image/')) {
          throw new Error('Please select a valid image file');
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB
          throw new Error('Image size must be less than 5MB');
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch(`${API_BASE_URL}/media/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorData;
            try {
              if (contentType?.includes('application/json')) {
                errorData = await response.json();
              } else {
                errorData = { detail: await response.text() };
              }
            } catch {
              errorData = { detail: `Upload failed: HTTP ${response.status}` };
            }
            throw new Error(errorData.detail || 'Failed to upload banner');
          }

          const data = await response.json();
          const bannerUrl = data.url;

          // Update user profile with new banner URL
          const updateResponse = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ background_url: bannerUrl }),
          });

          if (!updateResponse.ok) {
            const error = await updateResponse.json();
            throw new Error(error.detail || 'Failed to update profile with banner');
          }

          // Update local profile state
          const { profile } = get();
          if (profile) {
            set({ profile: { ...profile, background_url: bannerUrl } });
          }

          return bannerUrl;
        } catch (error: unknown) {
          if (error instanceof TypeError && (error as TypeError).message.includes('Failed to fetch')) {
            throw new Error(
              'Network error: Unable to connect to server. Please check if the backend is running at ' +
              API_BASE_URL
            );
          }
          throw error;
        }
      },

      // Upload gallery image for business profile
      uploadGalleryImage: async (file: File): Promise<string> => {
        const { session, businessProfile } = get();
        if (!session?.access_token) throw new Error('Not authenticated');
        if (!businessProfile) throw new Error('No business profile');

        // Validate file
        if (!file.type.startsWith('image/')) {
          throw new Error('Please select a valid image file');
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB
          throw new Error('Image size must be less than 5MB');
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
          // Upload the image
          const response = await fetch(`${API_BASE_URL}/media/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorData;
            try {
              if (contentType?.includes('application/json')) {
                errorData = await response.json();
              } else {
                errorData = { detail: await response.text() };
              }
            } catch {
              errorData = { detail: `Upload failed: HTTP ${response.status}` };
            }
            throw new Error(errorData.detail || 'Failed to upload image');
          }

          const data = await response.json();
          const imageUrl = data.url;

          // Add to existing gallery images
          const currentGallery = businessProfile.gallery_images || [];
          const updatedGallery = [...currentGallery, imageUrl];

          // Update business profile with new gallery
          const updateResponse = await fetch(`${API_BASE_URL}/business/profile`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              business_name: businessProfile.business_name,
              gallery_images: updatedGallery,
            }),
          });

          if (!updateResponse.ok) {
            const error = await updateResponse.json();
            throw new Error(error.detail || 'Failed to update gallery');
          }

          const updated = await updateResponse.json();
          set({ businessProfile: updated });

          return imageUrl;
        } catch (error: unknown) {
          if (error instanceof TypeError && (error as TypeError).message.includes('Failed to fetch')) {
            throw new Error(
              'Network error: Unable to connect to server. Please check if the backend is running at ' +
              API_BASE_URL
            );
          }
          throw error;
        }
      },

      // Set Selected City (persist to backend if authenticated)
      setSelectedCity: async (city: string) => {
        const { session, profile } = get();
        set({ selectedCity: city });
        if (session?.access_token) {
          try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ preferred_city: city }),
            });
            if (response.ok && profile) {
              const cityObj = get().cities.find(c => c.id.toLowerCase() === city.toLowerCase()) || null;
              set({
                profile: {
                  ...profile,
                  city_id: city,
                  city: cityObj,
                }
              });
            }
          } catch (error) {
            console.error('Failed to persist city selection:', error);
          }
        }
      },

      // Refresh Session
      refreshSession: async () => {
        try {
          // Check for stored token first
          const token = localStorage.getItem('auth-token');

          if (token) {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (response.ok) {
              const backendUser = await response.json();

              const { profile } = get();
              if (profile) {
                const city = get().cities.find(c =>
                  c.id.toLowerCase() === (backendUser.preferred_city || '').toLowerCase()
                ) || null;
                const updatedProfile: Profile = {
                  ...profile,
                  first_name: backendUser.first_name,
                  last_name: backendUser.last_name,
                  display_name: `${backendUser.first_name || ''} ${backendUser.last_name || ''}`.trim(),
                  username: backendUser.username || null,
                  avatar_url: backendUser.avatar_url,
                  banner_url: backendUser.background_url,
                  bio: backendUser.bio,
                  city_id: backendUser.preferred_city,
                  city: city,
                  phone: backendUser.phone,
                  instagram: backendUser.instagram,
                  twitter: backendUser.twitter,
                  wechat_id: backendUser.wechat_id,
                  website: backendUser.website,
                  is_verified: backendUser.is_verified,
                  verification_status: backendUser.is_verified ? 'verified' : 'unverified',
                };
                set({ profile: updatedProfile, selectedCity: backendUser.preferred_city || null });
              }
            }
          }
        } catch (error) {
          console.error('Session refresh error:', error);
        }
      },

      // Fetch Business Profile
      fetchBusinessProfile: async () => {
        const { session } = get();
        if (!session?.access_token) return;

        try {
          const response = await fetch(`${API_BASE_URL}/business/profile`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (response.ok) {
            const businessProfile = await response.json();
            set({ businessProfile });
          }
        } catch (error) {
          console.error('Failed to fetch business profile:', error);
        }
      },

      // Fetch Artist Profile
      fetchArtistProfile: async () => {
        const { session } = get();
        if (!session?.access_token) return;

        try {
          const response = await fetch(`${API_BASE_URL}/artist/profile`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            // Backend returns nested { user, artist_profile }; extract artist_profile
            const artistProfile = data.artist_profile || data;
            set({ artistProfile });
          }
        } catch (error) {
          console.error('Failed to fetch artist profile:', error);
        }
      },

      // Create Business Profile
      createBusinessProfile: async (data: BusinessProfileData) => {
        const { user, profile, session } = get();
        if (!user || !profile || !session?.access_token) throw new Error('Not authenticated');

        set({ isLoading: true });

        try {
          const response = await fetch(`${API_BASE_URL}/business/profile`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create business profile');
          }

          const businessProfile = await response.json();

          // Only update role if user isn't already an admin/super_admin
          const currentRoleType = profile.role_type;
          const isAdmin = currentRoleType === 'admin' || currentRoleType === 'super_admin';
          const updatedProfile: Profile = {
            ...profile,
            ...(isAdmin ? {} : { role_type: 'business', role: 'organizer' })
          };

          set({
            profile: updatedProfile,
            businessProfile,
            isLoading: false,
          });
        } catch (error: unknown) {
          console.error('Business profile creation error:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      // Update Business Profile
      updateBusinessProfile: async (data: Partial<BusinessProfile>) => {
        const { businessProfile, session } = get();
        if (!businessProfile || !session?.access_token) throw new Error('No business profile');

        try {
          const response = await fetch(`${API_BASE_URL}/business/profile`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update business profile');
          }

          const updated = await response.json();
          set({ businessProfile: updated });
        } catch (error: unknown) {
          console.error('Business profile update error:', error);
          throw error;
        }
      },

      // Create Artist Profile
      createArtistProfile: async (data: ArtistProfileData) => {
        const { user, profile, session } = get();
        if (!user || !profile || !session?.access_token) throw new Error('Not authenticated');

        set({ isLoading: true });

        try {
          const response = await fetch(`${API_BASE_URL}/artist/profile`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create artist profile');
          }

          const artistProfile = await response.json();

          const updatedProfile: Profile = {
            ...profile,
            role_type: 'artist',
            role: 'dj'
          };

          set({
            profile: updatedProfile,
            artistProfile,
            isLoading: false,
          });
        } catch (error: unknown) {
          console.error('Artist profile creation error:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      // Update Artist Profile
      updateArtistProfile: async (data: Partial<ArtistProfile>) => {
        const { artistProfile, session } = get();
        if (!artistProfile || !session?.access_token) throw new Error('No artist profile');

        try {
          const response = await fetch(`${API_BASE_URL}/artist/profile`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update artist profile');
          }

          const updated = await response.json();
          set({ artistProfile: updated });
        } catch (error: unknown) {
          console.error('Artist profile update error:', error);
          throw error;
        }
      },

      // Check if admin
      isAdmin: () => {
        const { profile } = get();
        return profile?.role_type === 'admin' ||
          profile?.role_type === 'super_admin' ||
          profile?.role === 'admin' ||
          profile?.role === 'super_admin';
      },

      // Set profile directly (used for refreshing profile data)
      setProfile: (profile: Profile) => {
        set({ profile });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        session: state.session,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        selectedCity: state.selectedCity,
      }),
    }
  )
);

export default useAuthStore;
