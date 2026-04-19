import { useEffect } from 'react';
import { useSubscriptionStore, canAccessFeature } from '@/store/subscriptionStore';
import { useAuthStore } from '@/store/authStore';

export function useSubscriptionGuard(feature: string) {
  const { hasSubscription, planType, isLoading } = useSubscriptionStore();
  const { profile } = useAuthStore();

  useEffect(() => {
    if (isLoading || hasSubscription === null) return;
    // Verified users bypass subscription requirement
    if (profile?.is_verified) return;

    const hasAccess = hasSubscription && canAccessFeature(planType, feature);
    if (!hasAccess) {
      window.dispatchEvent(new CustomEvent('plan-restricted', {
        detail: { featureName: feature }
      }));
    }
  }, [hasSubscription, planType, isLoading, feature, profile?.is_verified]);
}
