/**
 * Analytics, Meta Pixel (CAPI Deduplication), and Google Ads Enhanced Conversions
 * ==============================================================================
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Generate a unique event ID for deduplicating client-side Meta Pixel
 * events with server-side Conversions API (CAPI) events.
 */
export function generateEventId(eventName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${eventName}_${timestamp}_${random}`;
}

/**
 * Track Meta Pixel event with deduplication event_id
 */
export function trackMetaPixel(
  eventName: string,
  params: Record<string, any> = {},
  eventId?: string
) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    const eid = eventId || generateEventId(eventName);
    window.fbq("track", eventName, params, { eventID: eid });
    return eid;
  }
  return null;
}

/**
 * Track Google Ads conversion with optional Enhanced Conversion data (hashed user info)
 */
export function trackGoogleConversion(
  conversionId: string,
  conversionLabel: string,
  data: {
    value?: number;
    currency?: string;
    transaction_id?: string;
    email?: string;
    phone_number?: string;
  } = {}
) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    // Set enhanced conversion user data if email/phone provided
    if (data.email || data.phone_number) {
      window.gtag("set", "user_data", {
        email: data.email?.trim().toLowerCase(),
        phone_number: data.phone_number?.trim(),
      });
    }

    // Send conversion event
    window.gtag("event", "conversion", {
      send_to: `${conversionId}/${conversionLabel}`,
      value: data.value,
      currency: data.currency || "USD",
      transaction_id: data.transaction_id,
    });
  }
}
