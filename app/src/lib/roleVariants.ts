/**
 * Role Variant system — maps each account's sub-type (vendor type, artist type,
 * business type) to a tailored dashboard identity: label, tagline and
 * variant-specific content hints. Used by Vendor/Artist/Business dashboards
 * and the admin dashboard breakdown.
 */

// ── Vendors ────────────────────────────────────────────────────────────────

export type VendorVariantKey = 'food' | 'beverage' | 'merch' | 'service' | 'other';

export interface VendorVariant {
  key: VendorVariantKey;
  label: string;
  tagline: string;
  /** Which quick actions to surface first on the overview */
  primaryActions: Array<'menu-import' | 'products' | 'payment-qr' | 'analytics' | 'messages' | 'profile'>;
  productsLabel: string;
}

export function getVendorVariant(vendorType?: string | null): VendorVariant {
  const v = (vendorType || '').toLowerCase();
  if (v === 'food') return {
    key: 'food', label: 'Food Vendor',
    tagline: 'Menus, pre-orders and event booths — import your menu and start taking orders.',
    primaryActions: ['menu-import', 'payment-qr', 'analytics', 'messages', 'profile'],
    productsLabel: 'Menu Items',
  };
  if (v === 'beverage') return {
    key: 'beverage', label: 'Beverage Vendor',
    tagline: 'Drinks, bar service and event booths — keep your listings fresh.',
    primaryActions: ['menu-import', 'payment-qr', 'analytics', 'messages', 'profile'],
    productsLabel: 'Drink List',
  };
  if (v === 'merch') return {
    key: 'merch', label: 'Retail & Merch',
    tagline: 'Clothing, jewelry and products — manage stock, listings and orders.',
    primaryActions: ['products', 'payment-qr', 'analytics', 'messages', 'profile'],
    productsLabel: 'Products',
  };
  if (v === 'service') return {
    key: 'service', label: 'Service Provider',
    tagline: 'Offer your services — track requests, bookings and payouts.',
    primaryActions: ['products', 'analytics', 'messages', 'profile', 'payment-qr'],
    productsLabel: 'Services',
  };
  return {
    key: 'other', label: 'Vendor',
    tagline: 'Sell products or services — manage listings, orders and event booths.',
    primaryActions: ['products', 'menu-import', 'payment-qr', 'analytics', 'messages', 'profile'],
    productsLabel: 'Products',
  };
}

// ── Artists ────────────────────────────────────────────────────────────────

export type ArtistVariantKey = 'dj' | 'singer' | 'mc' | 'dancer' | 'photographer' | 'band' | 'artist';

export interface ArtistVariant {
  key: ArtistVariantKey;
  label: string;
  tagline: string;
  gigsLabel: string;
  portfolioHint: string;
}

export function getArtistVariant(artistType?: string | null): ArtistVariant {
  const v = (artistType || 'artist').toLowerCase();
  if (v === 'dj') return {
    key: 'dj', label: 'DJ',
    tagline: 'Mixes, gigs and bookings — upload your best set and get booked.',
    gigsLabel: 'Sets Booked', portfolioHint: 'Upload one audio mix, up to 10 minutes.',
  };
  if (v === 'singer' || v === 'vocalist') return {
    key: 'singer', label: 'Singer',
    tagline: 'Songs, shows and bookings — share your voice and get discovered.',
    gigsLabel: 'Shows Booked', portfolioHint: 'Upload songs, up to 3 minutes each.',
  };
  if (v === 'mc' || v === 'host') return {
    key: 'mc', label: 'MC / Host',
    tagline: 'Hosting, events and bookings — keep your calendar full.',
    gigsLabel: 'Events Hosted', portfolioHint: 'Upload performance videos up to 1 minute each.',
  };
  if (v === 'dancer') return {
    key: 'dancer', label: 'Dancer',
    tagline: 'Choreography, performances and bookings — show your moves.',
    gigsLabel: 'Performances', portfolioHint: 'Upload performance videos up to 2 minutes each.',
  };
  if (v === 'photographer' || v === 'videographer') return {
    key: 'photographer', label: 'Photographer',
    tagline: 'Portfolios, shoots and bookings — let your photos book you.',
    gigsLabel: 'Shoots Booked', portfolioHint: 'Upload up to 60 portfolio images.',
  };
  if (v === 'band' || v === 'musician' || v === 'rapper' || v === 'producer' || v === 'instrumentalist') return {
    key: 'band', label: 'Musician / Band',
    tagline: 'Music, live shows and bookings — grow your fanbase.',
    gigsLabel: 'Gigs Played', portfolioHint: 'Upload songs or live videos to showcase your sound.',
  };
  return {
    key: 'artist', label: 'Artist',
    tagline: 'Performances and bookings — complete your profile to get discovered.',
    gigsLabel: 'Gigs', portfolioHint: 'Choose a focused category to enable native work uploads.',
  };
}

// ── Business / Organizer ───────────────────────────────────────────────────

export type BusinessVariantKey = 'organizer' | 'club' | 'bar' | 'lounge' | 'restaurant' | 'venue' | 'other';

export interface BusinessVariant {
  key: BusinessVariantKey;
  label: string;
  tagline: string;
  primaryActions: Array<'create-event' | 'events' | 'tables' | 'staff' | 'promoters' | 'finance' | 'followers' | 'scanner' | 'analytics'>;
}

export function getBusinessVariant(businessType?: string[] | string | null, isOrganizer?: boolean | null): BusinessVariant {
  const list = Array.isArray(businessType) ? businessType.map(x => x.toLowerCase()) : (businessType ? [businessType.toLowerCase()] : []);
  if (isOrganizer || list.includes('organizer')) return {
    key: 'organizer', label: 'Event Organizer',
    tagline: 'Create events, sell tickets and manage your team — your events, your stage.',
    primaryActions: ['create-event', 'events', 'scanner', 'promoters', 'analytics', 'staff', 'finance'],
  };
  if (list.includes('club')) return {
    key: 'club', label: 'Club',
    tagline: 'Nights, tables and ticketed events — run the floor and fill the room.',
    primaryActions: ['tables', 'create-event', 'events', 'staff', 'followers', 'finance', 'analytics'],
  };
  if (list.includes('bar')) return {
    key: 'bar', label: 'Bar',
    tagline: 'Reservations, regulars and events — keep the bar busy every night.',
    primaryActions: ['tables', 'create-event', 'events', 'followers', 'staff', 'finance', 'analytics'],
  };
  if (list.includes('lounge')) return {
    key: 'lounge', label: 'Lounge',
    tagline: 'A laid-back space — reservations, events and your community.',
    primaryActions: ['tables', 'create-event', 'events', 'followers', 'finance', 'analytics'],
  };
  if (list.includes('restaurant')) return {
    key: 'restaurant', label: 'Restaurant',
    tagline: 'Tables, food and private events — seat every guest, host every night.',
    primaryActions: ['tables', 'create-event', 'events', 'staff', 'followers', 'finance', 'analytics'],
  };
  if (list.includes('venue')) return {
    key: 'venue', label: 'Venue',
    tagline: 'Host events, manage bookings and partner with organizers.',
    primaryActions: ['create-event', 'events', 'tables', 'staff', 'followers', 'finance', 'analytics'],
  };
  return {
    key: 'other', label: 'Business',
    tagline: 'Events, reservations and finance — everything your business needs.',
    primaryActions: ['create-event', 'events', 'tables', 'staff', 'followers', 'finance', 'analytics'],
  };
}
