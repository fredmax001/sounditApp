import { create } from 'zustand';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

export type PlanType = 'basic' | 'pro' | 'premium' | null;

export interface SubscriptionFeatures {
  event_limit?: number | null;
  featured_listing?: boolean;
  analytics_access?: boolean;
  priority_support?: boolean;
  verified_badge?: boolean;
  homepage_spotlight?: boolean;
  portfolio_limit?: number | null;
  media_limit?: number | null;
  features?: string[];
}

export interface SubscriptionState {
  hasSubscription: boolean | null;
  planType: PlanType;
  features: SubscriptionFeatures;
  role: string | null;
  daysRemaining: number | null;
  isTrial: boolean;
  isLoading: boolean;
  error: string | null;
  checkSubscription: (token: string) => Promise<void>;
  reset: () => void;
}

// Feature requirement map: feature -> minimum plan
const FEATURE_MIN_PLAN: Record<string, PlanType> = {
  analytics: 'pro',
  table_reservations: 'pro',
  featured_listing: 'pro',
  push_notifications: 'premium',
  promo_codes: 'pro',
  event_booths: 'pro',
  community_posts: 'pro',
  fan_feed: 'pro',
  payouts: 'pro',
  earnings: 'pro',
  verified_badge: 'premium',
  homepage_spotlight: 'premium',
  priority_support: 'premium',
};

const PLAN_RANK: Record<string, number> = {
  basic: 1,
  pro: 2,
  premium: 3,
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  hasSubscription: null,
  planType: null,
  features: {},
  role: null,
  daysRemaining: null,
  isTrial: false,
  isLoading: false,
  error: null,

  checkSubscription: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axios.get(`${API_BASE_URL}/subscriptions/my-subscription`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      const hasSub = !!data?.has_subscription;
      const plan = (data?.subscription?.plan_type || data?.pending_subscription?.plan_type || null) as PlanType;
      const feats = data?.features || {};
      const roleValue = data?.role || null;
      const days = data?.subscription?.days_remaining ?? null;
      const isTrial = data?.is_trial || data?.subscription?.is_trial || false;

      set({
        hasSubscription: hasSub,
        planType: plan,
        features: feats,
        role: roleValue,
        daysRemaining: days,
        isTrial,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        hasSubscription: false,
        planType: null,
        features: {},
        role: null,
        daysRemaining: null,
        isTrial: false,
        isLoading: false,
        error: err?.response?.data?.detail || err?.message || 'Failed to check subscription',
      });
    }
  },

  reset: () => {
    set({
      hasSubscription: null,
      planType: null,
      features: {},
      role: null,
      daysRemaining: null,
      isTrial: false,
      isLoading: false,
      error: null,
    });
  },
}));

export function canAccessFeature(planType: PlanType, feature: string): boolean {
  if (!planType) return false;
  const minPlan = FEATURE_MIN_PLAN[feature];
  if (!minPlan) return true; // no restriction defined
  return PLAN_RANK[planType] >= PLAN_RANK[minPlan];
}

export function getRequiredPlan(feature: string): string {
  const minPlan = FEATURE_MIN_PLAN[feature];
  if (!minPlan) return 'pro';
  return minPlan;
}

export function formatPlanName(plan: string | null): string {
  if (!plan) return 'Free';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
