// Auth & User
export { useAuthStore } from './authStore';
export type { UserRole, Profile, BusinessProfile, ArtistProfile, City } from './authStore';

// Events
export { useEventStore } from './eventStore';
export type { Event, EventWithDetails, TicketTier, DJ, EventFilters, CreateEventData } from './eventStore';

// Tickets & Orders
export { useTicketStore } from './ticketStore';
export type { Ticket, Order, CreateOrderData, PurchaseTicketData } from './ticketStore';

// Payments
export { usePaymentStore } from './paymentStore';
export type { PaymentState } from './paymentStore';

// Bookings
export { useBookingStore, BookingStatus } from './bookingStore';
export type { BookingStatus as BookingStatusType } from './bookingStore';

// Admin
export { useAdminStore } from './adminStore';
export type { VerificationRequest, Payout, AdminUser } from './adminStore';

// Dashboard
export { useDashboardStore } from './dashboardStore';
export type { DashboardStats, Activity } from './dashboardStore';

// Vendor
export { useVendorStore } from './vendorStore';
export type { Product, VendorProfile, Order as VendorOrder } from './vendorStore';

// Cart
export { useCartStore } from './cartStore';
export type { CartItem } from './cartStore';

// City Guide
export { useCityGuideStore } from './cityGuideStore';
export type { Club, FoodSpot, Review } from './cityGuideStore';

// OTP
export { useOTPStore } from './otpStore';

// Language
export { useLanguageStore } from './languageStore';

// Theme
export { useThemeStore } from './themeStore';

// Recaps
export { useRecapsStore } from './recapsStore';
export type { Recap, CreateRecapData, UpdateRecapData } from './recapsStore';

// Community
export { useCommunityStore } from './communityStore';
export type { CommunityPost, CommunityComment, CommunityAuthor } from './communityStore';
