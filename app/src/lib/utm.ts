/**
 * UTM Parameter Capture & Persistence Helper
 * ==========================================
 * Automatically captures UTM parameters from current URL and persists
 * them across navigation in sessionStorage/localStorage for lead attribution.
 */

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

const STORAGE_KEY = "soundit_utm_params";

/**
 * Capture UTM query parameters from current URL and persist to storage
 */
export function captureUtmParams(): UtmParams {
  if (typeof window === "undefined") return {};

  try {
    const params = new URLSearchParams(window.location.search);
    const utm: UtmParams = {};

    const source = params.get("utm_source");
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    const term = params.get("utm_term");
    const content = params.get("utm_content");

    if (source) utm.utm_source = source;
    if (medium) utm.utm_medium = medium;
    if (campaign) utm.utm_campaign = campaign;
    if (term) utm.utm_term = term;
    if (content) utm.utm_content = content;

    // Only update storage if UTM parameters are found in URL
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
      return utm;
    }

    // Fall back to existing stored UTM params
    const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }

  return {};
}

/**
 * Retrieve captured UTM parameters for form submission
 */
export function getUtmParams(): UtmParams {
  if (typeof window === "undefined") return {};

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return captureUtmParams();
  } catch {
    return {};
  }
}
